// create-proper-data-mart.js
db = db.getSiblingDB('news_aggregator');

print('=== CREATING PROPER DATA MART ===');

// Проверяем существование коллекции
if (!db.getCollectionNames().includes('authors_daily_stats')) {
    // Создаем витрину данных authors_daily_stats
    const result = db.news.aggregate([
        {
            $match: {
                "metadata.publishDate": { 
                    $gte: new Date(new Date().getTime() - 30 * 24 * 60 * 60 * 1000) // последние 30 дней
                }
            }
        },
        {
            $group: {
                _id: {
                    authorEmail: "$author.email",
                    authorName: { $concat: ["$author.firstName", " ", "$author.lastName"] },
                    date: { $dateToString: { format: "%Y-%m-%d", date: "$metadata.publishDate" } }
                },
                articlesCount: { $sum: 1 },
                totalViews: { $sum: "$metrics.views" },
                totalLikes: { $sum: "$metrics.likes" },
                totalShares: { $sum: "$metrics.shares" },
                categories: { $addToSet: "$category" }
            }
        },
        {
            $project: {
                _id: 0,
                authorEmail: "$_id.authorEmail",
                authorName: "$_id.authorName",
                date: "$_id.date",
                articlesCount: 1,
                totalViews: 1,
                totalLikes: 1,
                totalShares: 1,
                categoriesCount: { $size: "$categories" },
                categories: 1,
                avgViewsPerArticle: { $round: [{ $divide: ["$totalViews", "$articlesCount"] }, 2] }
            }
        },
        {
            $merge: {
                into: "authors_daily_stats",
                whenMatched: "replace",
                whenNotMatched: "insert"
            }
        }
    ]).toArray();

    print('✅ Data Mart "authors_daily_stats" created successfully!');
} else {
    print('⚠️  Data Mart "authors_daily_stats" already exists');
}

// Проверяем и создаем daily_stats если нужно
if (!db.getCollectionNames().includes('daily_stats')) {
    // Код создания daily_stats из вашего data-mart.js
    const dataMartPipeline = [
        {
            $match: {
                "metadata.isActive": true,
                "metadata.publishDate": { $gte: new Date("2024-01-01") }
            }
        },
        // ... остальной pipeline из data-mart.js
        { $out: "daily_stats" }
    ];

    db.news.aggregate(dataMartPipeline);
    print('✅ Data Mart "daily_stats" created successfully!');
} else {
    print('⚠️  Data Mart "daily_stats" already exists');
}

print('\n📊 Data Mart Status:');
db.getCollectionNames().forEach(col => {
    if (col.includes('stats') || col.includes('daily')) {
        print('- ' + col + ': ' + db[col].countDocuments() + ' documents');
    }
});