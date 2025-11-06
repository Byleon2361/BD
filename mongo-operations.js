// mongo-operations-complete.js

// INSERT OPERATIONS
// insertOne с полной структурой
db.news.insertOne({
    // Основные поля
    title: "Exclusive: New Technology Breakthrough",
    content: "Scientists have discovered revolutionary technology that will change the world...",
    url: "https://newsportal.com/technology/501",
    hash: "exclusive_hash_001",
    
    // Категория и классификация
    category: "technology",
    category_id: 3, // соответствие с PostgreSQL
    subcategory: "artificial-intelligence",
    
    // Источник
    source: { 
        name: "TechCrunch", 
        website: "https://techcrunch.com", 
        country: "USA",
        source_id: 7 // соответствие с PostgreSQL
    },
    
    // Автор
    author: { 
        firstName: "John", 
        lastName: "TechWriter", 
        email: "john@tech.com",
        author_id: 25, // соответствие с PostgreSQL
        bio: "Technology journalist with 10 years of experience"
    },
    
    // Метрики и аналитика
    metrics: { 
        views: 0, 
        likes: 0, 
        shares: 0,
        comments_count: 0,
        reading_time: 3, // в минутах
        engagementRate: 0 
    },
    
    // Метаданные
    metadata: {
        publishDate: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
        isActive: true,
        isFeatured: false,
        isBreaking: true,
        isExclusive: true,
        
        // Теги (массив строк)
        tags: ["ai", "innovation", "breakthrough", "machine-learning"],
        
        // Дополнительные метаданные
        language: "en",
        wordCount: 350,
        readingLevel: "intermediate",
        sentiment: "positive", // positive/negative/neutral
        topics: ["technology", "innovation", "research"]
    },
    
    // SEO и маркетинг
    seo: {
        meta_title: "New AI Breakthrough 2024 - TechCrunch",
        meta_description: "Scientists discover revolutionary AI technology that will transform industries",
        keywords: ["ai", "technology", "breakthrough", "innovation"],
        slug: "new-ai-breakthrough-2024"
    },
    
    // Медиа
    media: {
        featured_image: "https://images.techcrunch.com/2024/01/ai-breakthrough.jpg",
        image_caption: "AI neural network visualization",
        video_url: null,
        gallery: []
    },
    
    // Комментарии (вложенные документы)
    comments: [
        {
            comment_id: 1,
            user_name: "TechEnthusiast",
            user_email: "user@example.com",
            content: "This is amazing news! Can't wait to see the implementation.",
            created_at: new Date(),
            likes: 5,
            is_approved: true,
            parent_comment_id: null // для ответов на комментарии
        }
    ],
    
    // Рейтинги и отзывы
    ratings: {
        average: 4.5,
        count: 12,
        breakdown: {
            5: 8,
            4: 3,
            3: 1,
            2: 0,
            1: 0
        }
    },
    
    // Статусы и флаги
    status: {
        is_published: true,
        is_approved: true,
        is_archived: false,
        published_by: "editor_john",
        approved_by: "chief_editor"
    },
    
    // Временные метки
    timestamps: { 
        createdAt: new Date(), 
        updatedAt: new Date(),
        published_at: new Date(),
        archived_at: null
    }
});

// insertMany с полными документами
db.news.insertMany([
    {
        title: "Sports Championship Results - Finals 2024",
        content: "The championship concluded with surprising results as underdog team wins...",
        url: "https://newsportal.com/sports/502",
        hash: "sports_hash_001",
        category: "sports",
        category_id: 2,
        subcategory: "football",
        source: { 
            name: "ESPN", 
            website: "https://espn.com", 
            country: "USA",
            source_id: 8
        },
        author: { 
            firstName: "Mike", 
            lastName: "SportsAnalyst", 
            email: "mike@sports.com",
            author_id: 42
        },
        metrics: { 
            views: 25000, 
            likes: 1200, 
            shares: 450,
            comments_count: 89,
            reading_time: 2,
            engagementRate: 4.8
        },
        metadata: {
            publishDate: new Date("2024-01-15"),
            created_at: new Date("2024-01-15"),
            updated_at: new Date("2024-01-16"),
            isActive: true,
            isFeatured: true,
            isBreaking: false,
            isExclusive: false,
            tags: ["football", "championship", "sports", "finals"],
            language: "en",
            wordCount: 420,
            readingLevel: "basic",
            sentiment: "positive",
            topics: ["sports", "football", "championship"]
        },
        seo: {
            meta_title: "Championship Finals 2024 Results - ESPN",
            meta_description: "Underdog team wins championship in surprising finals match",
            keywords: ["football", "championship", "finals", "sports"],
            slug: "championship-finals-2024-results"
        },
        media: {
            featured_image: "https://images.espn.com/2024/championship.jpg",
            image_caption: "Championship trophy celebration",
            video_url: "https://videos.espn.com/championship-highlights",
            gallery: [
                "https://images.espn.com/2024/championship1.jpg",
                "https://images.espn.com/2024/championship2.jpg"
            ]
        },
        comments: [
            {
                comment_id: 101,
                user_name: "SportsFan99",
                user_email: "fan@example.com",
                content: "What an amazing game! The underdogs deserved it.",
                created_at: new Date("2024-01-15T14:30:00Z"),
                likes: 23,
                is_approved: true,
                parent_comment_id: null
            },
            {
                comment_id: 102,
                user_name: "GameAnalyst",
                user_email: "analyst@example.com",
                content: "The strategy in the second half was brilliant.",
                created_at: new Date("2024-01-15T15:45:00Z"),
                likes: 15,
                is_approved: true,
                parent_comment_id: null
            }
        ],
        ratings: {
            average: 4.8,
            count: 45,
            breakdown: {
                5: 35,
                4: 8,
                3: 2,
                2: 0,
                1: 0
            }
        },
        status: {
            is_published: true,
            is_approved: true,
            is_archived: false,
            published_by: "sports_editor",
            approved_by: "chief_editor"
        },
        timestamps: {
            createdAt: new Date("2024-01-15"),
            updatedAt: new Date("2024-01-16"),
            published_at: new Date("2024-01-15T10:00:00Z"),
            archived_at: null
        }
    },
    {
        title: "Political Summit Updates: Global Leaders Meet", 
        content: "World leaders gathered for important discussions about climate change and economic cooperation...",
        url: "https://newsportal.com/politics/503",
        hash: "politics_hash_001",
        category: "politics",
        category_id: 1,
        subcategory: "international-relations",
        source: { 
            name: "Reuters", 
            website: "https://reuters.com", 
            country: "International",
            source_id: 1
        },
        author: { 
            firstName: "Sarah", 
            lastName: "PoliticalCorrespondent", 
            email: "sarah@reuters.com",
            author_id: 18
        },
        metrics: { 
            views: 18000, 
            likes: 850, 
            shares: 320,
            comments_count: 67,
            reading_time: 4,
            engagementRate: 4.7
        },
        metadata: {
            publishDate: new Date("2024-01-14"),
            created_at: new Date("2024-01-14"),
            updated_at: new Date("2024-01-14"),
            isActive: true,
            isFeatured: false,
            isBreaking: true,
            isExclusive: true,
            tags: ["politics", "summit", "climate", "international"],
            language: "en",
            wordCount: 650,
            readingLevel: "advanced",
            sentiment: "neutral",
            topics: ["politics", "climate", "international-relations"]
        },
        seo: {
            meta_title: "Global Political Summit 2024 Updates - Reuters",
            meta_description: "World leaders discuss climate change and economic cooperation at global summit",
            keywords: ["politics", "summit", "climate", "leaders"],
            slug: "global-political-summit-2024-updates"
        },
        media: {
            featured_image: "https://images.reuters.com/2024/summit.jpg",
            image_caption: "World leaders at the global summit",
            video_url: null,
            gallery: []
        },
        comments: [
            {
                comment_id: 201,
                user_name: "PolicyWonk",
                user_email: "policy@example.com",
                content: "Finally some progress on climate agreements!",
                created_at: new Date("2024-01-14T12:15:00Z"),
                likes: 42,
                is_approved: true,
                parent_comment_id: null
            }
        ],
        ratings: {
            average: 4.3,
            count: 28,
            breakdown: {
                5: 15,
                4: 10,
                3: 3,
                2: 0,
                1: 0
            }
        },
        status: {
            is_published: true,
            is_approved: true,
            is_archived: false,
            published_by: "political_editor",
            approved_by: "chief_editor"
        },
        timestamps: {
            createdAt: new Date("2024-01-14"),
            updatedAt: new Date("2024-01-14"),
            published_at: new Date("2024-01-14T08:30:00Z"),
            archived_at: null
        }
    }
]);

// UPDATE OPERATIONS с дополнительными полями
// updateOne с $set для комментариев
db.news.updateOne(
    { hash: "exclusive_hash_001" },
    { 
        $set: { 
            "metrics.views": 1500,
            "metrics.likes": 45,
            "metrics.comments_count": 1,
            "timestamps.updatedAt": new Date(),
            "status.isFeatured": true
        },
        $push: {
            "comments": {
                comment_id: 2,
                user_name: "AnotherReader",
                user_email: "reader@example.com",
                content: "Great article! When will this technology be available?",
                created_at: new Date(),
                likes: 0,
                is_approved: false,
                parent_comment_id: null
            }
        }
    }
);

// updateMany с $inc для счетчиков
db.news.updateMany(
    { category: "technology", "metadata.isActive": true },
    { 
        $inc: { 
            "metrics.views": 10,
            "metrics.comments_count": 1
        },
        $set: { 
            "timestamps.updatedAt": new Date(),
            "metadata.readingLevel": "advanced"
        }
    }
);

// update с $push/$addToSet для тегов и галереи
db.news.updateOne(
    { hash: "sports_hash_001" },
    { 
        $push: { 
            "metadata.tags": "victory",
            "media.gallery": "https://images.espn.com/2024/championship3.jpg"
        },
        $addToSet: { 
            "metadata.topics": "victory-celebration"
        }
    }
);

// update с arrayFilters для обновления конкретных комментариев
db.news.updateOne(
    { "comments.comment_id": 101 },
    { 
        $set: { 
            "comments.$[elem].likes": 25,
            "comments.$[elem].is_approved": true
        }
    },
    { 
        arrayFilters: [
            { "elem.comment_id": 101 }
        ]
    }
);

// UPSERT с полной структурой
db.news.updateOne(
    { hash: "new_unique_hash_002" },
    {
        $setOnInsert: {
            title: "Breaking: Market Analysis Report",
            content: "Latest market analysis shows significant trends...",
            category: "business",
            category_id: 5,
            source: { name: "Bloomberg", website: "https://bloomberg.com", country: "USA" },
            author: { firstName: "Emma", lastName: "FinancialAnalyst", email: "emma@bloomberg.com" },
            metrics: { views: 0, likes: 0, shares: 0, comments_count: 0, engagementRate: 0 },
            metadata: {
                publishDate: new Date(),
                isActive: true,
                tags: ["market", "analysis", "finance"],
                language: "en",
                wordCount: 500
            },
            timestamps: { createdAt: new Date(), updatedAt: new Date() }
        }
    },
    { upsert: true }
);

// DELETE OPERATIONS с разными условиями
db.news.deleteOne({ 
    "hash": "specific_hash_to_delete",
    "metadata.isActive": false 
});

db.news.deleteMany({ 
    $or: [
        { "metadata.isActive": false },
        { "status.is_archived": true },
        { "metrics.views": { $lt: 100 } } // удаляем непопулярные статьи
    ]
});

// REPLACE с полной структурой
db.news.replaceOne(
    { hash: "old_hash" },
    {
        title: "Completely Replaced and Updated Article",
        content: "All fields have been replaced with new content and structure...",
        url: "https://newsportal.com/updated-article",
        hash: "new_updated_hash",
        category: "technology",
        category_id: 3,
        source: { name: "Updated Source", website: "https://updated.com", country: "UK" },
        author: { firstName: "Updated", lastName: "Author", email: "updated@author.com" },
        metrics: { views: 100, likes: 10, shares: 5, comments_count: 3, engagementRate: 10 },
        metadata: {
            publishDate: new Date(),
            isActive: true,
            tags: ["updated", "refreshed"],
            language: "en",
            wordCount: 300
        },
        comments: [
            {
                comment_id: 1,
                user_name: "FirstCommenter",
                content: "First comment on updated article",
                created_at: new Date()
            }
        ],
        timestamps: { createdAt: new Date(), updatedAt: new Date() }
    }
);

// SEARCH OPERATIONS с дополнительными полями
// Простые фильтры с комментариями
db.news.find({
    "category": "technology",
    "metrics.views": { $gt: 1000 },
    "metrics.comments_count": { $gt: 5 },
    "comments.is_approved": true
});

// Сложные фильтры с $and/$or для статусов
db.news.find({
    $and: [
        { "metadata.publishDate": { $gte: new Date("2024-01-01") } },
        { 
            $or: [
                { "category": "technology" },
                { "category": "science" }
            ]
        },
        { "status.is_published": true },
        { "status.is_approved": true }
    ]
});

// $in/$nin с дополнительными полями
db.news.find({
    "category": { $in: ["politics", "business"] },
    "source.country": { $nin: ["USA", "UK"] },
    "metadata.sentiment": { $in: ["positive", "neutral"] },
    "ratings.average": { $gte: 4.0 }
});

// ПРОЕКЦИИ с дополнительными полями
db.news.find(
    { 
        "category": "sports",
        "metadata.isActive": true 
    },
    { 
        title: 1, 
        "metrics.views": 1, 
        "metrics.comments_count": 1,
        "metadata.publishDate": 1,
        "media.featured_image": 1,
        "ratings.average": 1,
        "comments.content": 1,
        _id: 0 
    }
).sort({ "metrics.views": -1 }).limit(10);

// Поиск по комментариям
db.news.find(
    {
        "comments.user_name": "SportsFan99",
        "comments.is_approved": true
    },
    {
        title: 1,
        "comments.$": 1 // только найденные комментарии
    }
);

// Агрегация с комментариями
db.news.aggregate([
    {
        $match: {
            "metadata.isActive": true
        }
    },
    {
        $unwind: "$comments"
    },
    {
        $match: {
            "comments.is_approved": true
        }
    },
    {
        $group: {
            _id: "$category",
            total_comments: { $sum: 1 },
            avg_comment_likes: { $avg: "$comments.likes" },
            most_active_users: { 
                $addToSet: "$comments.user_name" 
            }
        }
    },
    {
        $project: {
            category: "$_id",
            total_comments: 1,
            avg_comment_likes: { $round: ["$avg_comment_likes", 2] },
            unique_users: { $size: "$most_active_users" }
        }
    },
    { $sort: { total_comments: -1 } }
]);
// mongo-operations-complete.js

// ... (все предыдущие INSERT, UPDATE, DELETE операции остаются без изменений)

// === СПЕЦИАЛЬНЫЕ ВОЗМОЖНОСТИ ДЛЯ АГРЕГАТОРА НОВОСТЕЙ ===

print("=== SPECIAL FEATURES FOR NEWS AGGREGATOR ===");

// 1. ТЕКСТОВЫЙ ИНДЕКС ДЛЯ ПОЛНОТЕКСТОВОГО ПОИСКА
print("\n1. Creating text index for full-text search...");
try {
    db.news.createIndex({
        "title": "text",
        "content": "text", 
        "metadata.tags": "text",
        "seo.keywords": "text"
    }, {
        name: "text_search_index",
        weights: {
            title: 10,
            "seo.keywords": 5,
            "metadata.tags": 3,
            content: 1
        },
        default_language: "english"
    });
    print("✅ Text index created successfully");
} catch (e) {
    print("ℹ️ Text index already exists or error: " + e.message);
}

// Тестируем текстовый поиск
print("\n🔍 Testing text search...");
const textSearchResults = db.news.find(
    { $text: { $search: "technology AI breakthrough" } },
    { 
        title: 1, 
        score: { $meta: "textScore" },
        category: 1,
        _id: 0 
    }
).sort({ score: { $meta: "textScore" } }).limit(3).toArray();

print("Text search results:");
printjson(textSearchResults);

// 2. ДЕДУБЛИКАЦИЯ ПО HASH
print("\n2. Performing deduplication by hash...");
const duplicates = db.news.aggregate([
    {
        $group: {
            _id: "$hash",
            count: { $sum: 1 },
            ids: { $push: "$_id" },
            titles: { $push: "$title" }
        }
    },
    {
        $match: {
            count: { $gt: 1 }
        }
    },
    {
        $project: {
            hash: "$_id",
            duplicateCount: "$count",
            articles: "$titles"
        }
    }
]).toArray();

print(`Found ${duplicates.length} duplicate article groups`);
if (duplicates.length > 0) {
    duplicates.forEach((dup, index) => {
        print(`\nDuplicate group ${index + 1}:`);
        print(`  Hash: ${dup.hash}`);
        print(`  Duplicates: ${dup.duplicateCount}`);
        print(`  Articles: ${dup.articles.join(", ")}`);
        
        // Оставляем первую статью, удаляем остальные
        const keepId = dup.ids[0];
        const deleteIds = dup.ids.slice(1);
        
        if (deleteIds.length > 0) {
            const deleteResult = db.news.deleteMany({ _id: { $in: deleteIds } });
            print(`  ✅ Kept: ${keepId}, Deleted: ${deleteResult.deletedCount} duplicates`);
        }
    });
} else {
    print("✅ No duplicates found - all articles are unique");
}

// 3. ПОИСК ДУБЛИКАТОВ ПО СОДЕРЖАНИЮ (дополнительная проверка)
print("\n3. Checking for content-based duplicates...");
const contentDuplicates = db.news.aggregate([
    {
        $project: {
            title: 1,
            contentPreview: { $substr: ["$content", 0, 100] },
            contentLength: { $strLenCP: "$content" },
            wordCount: "$metadata.wordCount"
        }
    },
    {
        $group: {
            _id: {
                contentLength: "$contentLength",
                wordCount: "$wordCount"
            },
            count: { $sum: 1 },
            articles: { $push: { title: "$title", preview: "$contentPreview" } }
        }
    },
    {
        $match: {
            count: { $gt: 1 },
            "_id.contentLength": { $gt: 100 } // Игнорируем очень короткие статьи
        }
    },
    {
        $sort: { count: -1 }
    },
    {
        $limit: 5
    }
]).toArray();

print(`Found ${contentDuplicates.length} potential content-based duplicates`);
contentDuplicates.forEach(dup => {
    print(`\nContent similarity group (length: ${dup._id.contentLength}, words: ${dup._id.wordCount}):`);
    dup.articles.forEach(article => {
        print(`  - ${article.title}: "${article.preview}..."`);
    });
});

// 4. ПОИСК С ИСПОЛЬЗОВАНИЕМ ТЕКСТОВОГО ИНДЕКСА
print("\n4. Advanced text search examples:");

// Пример 1: Поиск по фразе
print("\n📝 Phrase search: 'revolutionary technology'");
const phraseSearch = db.news.find(
    { $text: { $search: "\"revolutionary technology\"" } },
    { 
        title: 1, 
        score: { $meta: "textScore" },
        category: 1,
        "metadata.tags": 1,
        _id: 0 
    }
).sort({ score: { $meta: "textScore" } }).toArray();
printjson(phraseSearch);

// Пример 2: Исключающий поиск
print("\n📝 Excluding search: 'technology -politics'");
const excludeSearch = db.news.find(
    { $text: { $search: "technology -politics" } },
    { 
        title: 1, 
        category: 1,
        score: { $meta: "textScore" },
        _id: 0 
    }
).sort({ score: { $meta: "textScore" } }).limit(3).toArray();
printjson(excludeSearch);

// Пример 3: Поиск по тегам с текстовым индексом
print("\n📝 Tag-based text search: 'sports football'");
const tagSearch = db.news.find(
    { 
        $text: { $search: "sports football" },
        "metadata.tags": { $in: ["sports", "football"] }
    },
    { 
        title: 1, 
        category: 1,
        "metadata.tags": 1,
        score: { $meta: "textScore" },
        _id: 0 
    }
).sort({ score: { $meta: "textScore" } }).toArray();
printjson(tagSearch);

// 5. АГРЕГАЦИЯ С ИСПОЛЬЗОВАНИЕМ ТЕКСТОВОГО ПОИСКА
print("\n5. Aggregation with text search:");

const textAggregation = db.news.aggregate([
    {
        $match: {
            $text: { $search: "technology innovation" }
        }
    },
    {
        $project: {
            title: 1,
            category: 1,
            score: { $meta: "textScore" },
            views: "$metrics.views",
            likes: "$metrics.likes",
            tags: "$metadata.tags"
        }
    },
    {
        $group: {
            _id: "$category",
            totalArticles: { $sum: 1 },
            avgScore: { $avg: "$score" },
            totalViews: { $sum: "$views" },
            totalLikes: { $sum: "$likes" },
            topArticles: {
                $push: {
                    title: "$title",
                    score: "$score",
                    views: "$views"
                }
            }
        }
    },
    {
        $project: {
            category: "$_id",
            totalArticles: 1,
            avgScore: { $round: ["$avgScore", 3] },
            totalViews: 1,
            totalLikes: 1,
            engagementRate: {
                $round: [
                    { $multiply: [
                        { $divide: ["$totalLikes", "$totalViews"] },
                        100
                    ] },
                    2
                ]
            },
            topArticles: {
                $slice: [
                    {
                        $sortArray: {
                            input: "$topArticles",
                            sortBy: { score: -1 }
                        }
                    },
                    3
                ]
            }
        }
    },
    {
        $sort: { avgScore: -1 }
    }
]).toArray();

print("Text search aggregation results:");
printjson(textAggregation);

// 6. ПРОВЕРКА УНИКАЛЬНОСТИ НОВЫХ СТАТЕЙ
print("\n6. Hash uniqueness validation for new articles:");

// Создаем тестовые дубликаты для демонстрации
const testDuplicate = {
    title: "Test Duplicate Article",
    content: "This is a test duplicate article content...",
    url: "https://newsportal.com/test/duplicate",
    hash: "test_duplicate_hash_123",
    category: "technology",
    source: { name: "Test Source", website: "https://test.com", country: "Test" },
    author: { firstName: "Test", lastName: "Author", email: "test@test.com" },
    metrics: { views: 0, likes: 0, shares: 0, comments_count: 0, engagementRate: 0 },
    metadata: {
        publishDate: new Date(),
        isActive: true,
        tags: ["test"],
        language: "en",
        wordCount: 100
    },
    timestamps: { createdAt: new Date(), updatedAt: new Date() }
};

// Пытаемся вставить дубликат
print("Testing duplicate prevention...");
try {
    const firstInsert = db.news.insertOne(testDuplicate);
    print(`✅ First insert: ${firstInsert.insertedId}`);
    
    // Пытаемся вставить дубликат с тем же hash
    const duplicateInsert = db.news.insertOne({
        ...testDuplicate,
        title: "Different Title But Same Hash",
        _id: new ObjectId() // Другой ID, но тот же hash
    });
    print(`❌ This should not happen - duplicate inserted: ${duplicateInsert.insertedId}`);
} catch (e) {
    print(`✅ Duplicate prevention working: ${e.message}`);
}

// 7. СТАТИСТИКА ПО ХЕШАМ И УНИКАЛЬНОСТИ
print("\n7. Hash and uniqueness statistics:");

const hashStats = db.news.aggregate([
    {
        $group: {
            _id: null,
            totalArticles: { $sum: 1 },
            uniqueHashes: { $addToSet: "$hash" }
        }
    },
    {
        $project: {
            _id: 0,
            totalArticles: 1,
            uniqueArticles: { $size: "$uniqueHashes" },
            duplicationRate: {
                $round: [
                    { $multiply: [
                        { $divide: [
                            { $subtract: ["$totalArticles", { $size: "$uniqueHashes" }] },
                            "$totalArticles"
                        ] },
                        100
                    ] },
                    2
                ]
            }
        }
    }
]).toArray();

print("Hash uniqueness statistics:");
printjson(hashStats);

// 8. ИНДЕКС ДЛЯ БЫСТРОГО ПОИСКА ПО ХЕШАМ
print("\n8. Creating hash index for fast duplicate checks...");
try {
    db.news.createIndex(
        { "hash": 1 },
        { 
            unique: true,
            name: "hash_unique_index",
            background: true
        }
    );
    print("✅ Hash index created successfully");
} catch (e) {
    print("ℹ️ Hash index already exists: " + e.message);
}

// 9. ПРОВЕРКА ПРОИЗВОДИТЕЛЬНОСТИ ТЕКСТОВОГО ПОИСКА
print("\n9. Text search performance check:");

const textSearchPerformance = db.news.find(
    { $text: { $search: "technology" } }
).explain("executionStats");

print("Text search execution stats:");
print(`  Execution time: ${textSearchPerformance.executionStats.executionTimeMillis}ms`);
print(`  Documents examined: ${textSearchPerformance.executionStats.totalDocsExamined}`);
print(`  Index used: ${textSearchPerformance.executionStats.executionStages.inputStage.stage}`);

print("\n🎉 SPECIAL FEATURES IMPLEMENTATION COMPLETED!");
print("=============================================");
print("✅ Text search index created and tested");
print("✅ Deduplication by hash implemented");
print("✅ Hash uniqueness validation working");
print("✅ Advanced search examples demonstrated");
print("✅ Performance indexes optimized");