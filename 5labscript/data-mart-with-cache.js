// data-mart-with-cache.js
db = db.getSiblingDB('news_aggregator');

print('=== CREATING CACHED DATA MART WITH CHANGE STREAMS ===');

// 1. Сначала создаём/пересоздаём витрину
print('\nCreating authors_daily_stats data mart...');

const authorsDataMartPipeline = [
    {
        $match: {
            "metadata.isActive": true,
            "metadata.publishDate": { $gte: new Date("2024-01-01") }
        }
    },
    {
        $group: {
            _id: {
                authorEmail: "$author.email",
                authorName: { $concat: ["$author.firstName", " ", "$author.lastName"] }
            },
            articlesCount: { $sum: 1 },
            totalViews: { $sum: "$metrics.views" },
            totalLikes: { $sum: "$metrics.likes" },
            totalShares: { $sum: "$metrics.shares" },
            totalComments: { $sum: "$metrics.comments_count" },
            uniqueTagsCount: { $addToSet: "$metadata.tags" }
        }
    },
    {
        $project: {
            _id: 0,
            authorName: "$_id.authorName",
            authorEmail: "$_id.authorEmail",
            articlesCount: 1,
            totalViews: 1,
            totalLikes: 1,
            totalShares: 1,
            totalComments: 1,
            engagementRate: {
                $cond: [
                    { $gt: ["$totalViews", 0] },
                    { $round: [{ $multiply: [{ $divide: ["$totalLikes", "$totalViews"] }, 100] }, 3] },
                    0
                ]
            },
            viralityRate: {
                $cond: [
                    { $gt: ["$totalViews", 0] },
                    { $round: [{ $multiply: [{ $divide: ["$totalShares", "$totalViews"] }, 100] }, 3] },
                    0
                ]
            },
            authorScore: {
                $round: [
                    {
                        $add: [
                            { $multiply: [{ $divide: ["$totalViews", 1000] }, 0.4] },
                            { $multiply: ["$engagementRate", 0.3] },
                            { $multiply: ["$viralityRate", 0.2] },
                            { $multiply: [{ $divide: [{ $size: "$uniqueTagsCount" }, 10] }, 0.1] }
                        ]
                    },
                    2
                ]
            },
            lastUpdated: new Date()
        }
    },
    {
        $merge: {
            into: "authors_daily_stats",
            whenMatched: "replace",
            whenNotMatched: "insert"
        }
    }
];

db.news.aggregate(authorsDataMartPipeline);
print('Data mart authors_daily_stats created/updated!');

// 2. Запускаем Change Stream для автоматического обновления кэша
print('\nStarting Change Stream for real-time data mart updates...');
print('(This will run forever — press Ctrl+C to stop)');

const pipeline = [
    {
        $match: {
            $or: [
                { operationType: "insert" },
                { operationType: "update" },
                { operationType: { $in: ["replace", "update"] } }
            ],
            "fullDocument.metadata.isActive": true
        }
    }
];

const changeStream = db.news.watch(pipeline, { fullDocument: "updateLookup" });

print('Change Stream active. Listening for changes...');

while (!changeStream.isClosed()) {
    if (changeStream.hasNext()) {
        const change = changeStream.next();
        print(`\nChange detected: ${change.operationType} on document ${change.documentKey._id}`);
        
        // Пересчитываем весь data mart (можно оптимизировать — только для затронутого автора)
        try {
            db.news.aggregate(authorsDataMartPipeline);
            print('Data mart authors_daily_stats updated via Change Stream!');
        } catch (e) {
            print('Error updating data mart: ' + e.message);
        }
    }
    // Небольшая задержка, чтобы не грузить CPU
    sleep(100);
}

print('Change Stream closed.');