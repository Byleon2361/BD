// data-mart.js

print("=== CREATING DATA MART ===");

// Создаем витрину daily_stats
db.daily_stats.drop();

const dataMartPipeline = [
    {
        $match: {
            "metadata.isActive": true,
            "metadata.publishDate": { $gte: new Date("2024-01-01") }
        }
    },
    {
        $project: {
            date: { $dateToString: { format: "%Y-%m-%d", date: "$metadata.publishDate" } },
            category: 1,
            source: "$source.name",
            author: { $concat: ["$author.firstName", " ", "$author.lastName"] },
            views: "$metrics.views",
            likes: "$metrics.likes",
            shares: "$metrics.shares",
            comments_count: "$metrics.comments_count",
            reading_time: "$metrics.reading_time",
            tags: "$metadata.tags",
            wordCount: "$metadata.wordCount"
        }
    },
    {
        $group: {
            _id: {
                date: "$date",
                category: "$category",
                source: "$source"
            },
            articlesCount: { $sum: 1 },
            totalViews: { $sum: "$views" },
            totalLikes: { $sum: "$likes" },
            totalShares: { $sum: "$shares" },
            totalComments: { $sum: "$comments_count" },
            avgReadingTime: { $avg: "$reading_time" },
            avgWordCount: { $avg: "$wordCount" },
            uniqueTags: { $addToSet: "$tags" }
        }
    },
    {
        $unwind: "$uniqueTags"
    },
    {
        $unwind: "$uniqueTags"
    },
    {
        $group: {
            _id: "$_id",
            articlesCount: { $first: "$articlesCount" },
            totalViews: { $first: "$totalViews" },
            totalLikes: { $first: "$totalLikes" },
            totalShares: { $first: "$totalShares" },
            totalComments: { $first: "$totalComments" },
            avgReadingTime: { $first: "$avgReadingTime" },
            avgWordCount: { $first: "$avgWordCount" },
            uniqueTagsCount: { $sum: 1 }
        }
    },
    {
        $project: {
            _id: 0,
            date: "$_id.date",
            category: "$_id.category",
            source: "$_id.source",
            articlesCount: 1,
            totalViews: 1,
            totalLikes: 1,
            totalShares: 1,
            totalComments: 1,
            avgReadingTime: { $round: ["$avgReadingTime", 2] },
            avgWordCount: { $round: ["$avgWordCount", 2] },
            uniqueTagsCount: 1,
            engagementRate: {
                $round: [
                    { $multiply: [
                        { $divide: ["$totalLikes", "$totalViews"] }, 
                        100
                    ] },
                    3
                ]
            },
            viralityRate: {
                $round: [
                    { $multiply: [
                        { $divide: ["$totalShares", "$totalViews"] }, 
                        100
                    ] },
                    3
                ]
            }
        }
    },
    { $out: "daily_stats" }
];

print("Creating daily_stats data mart...");
db.news.aggregate(dataMartPipeline);

print("Data mart created successfully!");
print("Sample data from daily_stats:");
printjson(db.daily_stats.find().limit(5).toArray());