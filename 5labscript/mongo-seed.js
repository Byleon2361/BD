// complete-seed.js
db = db.getSiblingDB('news_aggregator');

print('=== COMPLETE MONGODB NEWS AGGREGATOR SETUP ===');

// Очищаем коллекции
db.news.deleteMany({});
db.authors_stats.deleteMany({});
db.categories.deleteMany({});
db.comments.deleteMany({});
db.daily_stats.deleteMany({});

print('Cleaned existing collections');

const categories = ["politics", "sports", "technology", "entertainment", "business", "health", "science"];
const sources = [
    { name: "Reuters", website: "https://reuters.com", country: "International" },
    { name: "BBC News", website: "https://bbc.com", country: "UK" },
    { name: "CNN", website: "https://cnn.com", country: "USA" },
    { name: "Al Jazeera", website: "https://aljazeera.com", country: "Qatar" },
    { name: "Associated Press", website: "https://apnews.com", country: "USA" },
    { name: "The Guardian", website: "https://theguardian.com", country: "UK" }
];

// Вспомогательные функции
function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomDate(start, end) {
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function getRandomElement(array) {
    return array[Math.floor(Math.random() * array.length)];
}

function generateHash(content) {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
        const char = content.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
}

function getTagsForCategory(category) {
    const baseTags = [category, 'news', 'latest'];
    const categoryTags = {
        technology: ['ai', 'innovation', 'tech', 'digital', 'software'],
        sports: ['football', 'competition', 'tournament', 'players', 'championship'],
        politics: ['government', 'election', 'policy', 'international', 'summit'],
        business: ['economy', 'market', 'finance', 'stocks', 'investment'],
        entertainment: ['movies', 'celebrities', 'music', 'awards', 'premiere'],
        health: ['medicine', 'wellness', 'fitness', 'research', 'treatment'],
        science: ['discovery', 'research', 'space', 'environment', 'climate']
    };
    return [...baseTags, ...(categoryTags[category] || [])];
}

// Генерация данных
const newsDocuments = [];
const commentsDocuments = [];
const authorStats = {};
const categoryStats = {};

print('Generating 520 news articles and 1000+ comments...');
const startDate = new Date(2023, 0, 1);
const endDate = new Date();

// Генерация новостей и комментариев
for (let i = 1; i <= 520; i++) {
    const category = categories[i % categories.length];
    const source = sources[i % sources.length];
    const authorId = getRandomInt(1, 25);
    const authorName = `Author_${authorId}`;
    const authorFullName = `Author_${authorId} LastName_${authorId}`;
    
    const publishDate = getRandomDate(startDate, endDate);
    const views = getRandomInt(1000, 50000);
    const likes = Math.floor(views * getRandomInt(2, 8) / 100);
    const shares = Math.floor(views * getRandomInt(1, 4) / 100);
    
    const title = `${category.charAt(0).toUpperCase() + category.slice(1)} News ${i}: ${getRandomElement(['Breaking', 'Exclusive', 'Latest', 'Update'])} ${getRandomElement(['Report', 'Analysis', 'Coverage'])}`;
    const content = `This is detailed content for news ${i} about ${category}. Significant developments have occurred with far-reaching implications. Experts are analyzing the latest trends and providing insights into future developments.`;
    
    // Создаем новость
    const newsDoc = {
        title: title,
        content: content,
        excerpt: `Summary of important ${category} developments in article ${i}`,
        url: `https://newsportal.com/${category}/${i}`,
        hash: generateHash(title + content),
        category: category,
        source: source,
        author: {
            name: authorFullName,
            email: `author${authorId}@news.com`
        },
        metrics: {
            views: views,
            likes: likes,
            shares: shares,
            comments: 0, // Будет обновлено после создания комментариев
            engagementRate: parseFloat((likes / views * 100).toFixed(2))
        },
        metadata: {
            publishDate: publishDate,
            isActive: true,
            isBreaking: i % 20 === 0,
            tags: getTagsForCategory(category),
            language: "en",
            readingTime: getRandomInt(2, 10),
            wordCount: getRandomInt(300, 1500)
        },
        status: 'published',
        createdAt: publishDate,
        updatedAt: publishDate
    };
    
    newsDocuments.push(newsDoc);
    
    // Генерация комментариев (2-5 на статью)
    const commentCount = getRandomInt(2, 5);
    for (let j = 0; j < commentCount; j++) {
        commentsDocuments.push({
            articleTitle: title,
            user: `user${getRandomInt(1000, 9999)}`,
            comment: `${getRandomElement(['Great article!', 'Very informative', 'Well written', 'Interesting perspective'])} This is comment ${j+1} on this news.`,
            likes: getRandomInt(0, 50),
            timestamp: new Date(publishDate.getTime() + getRandomInt(1, 48) * 60 * 60 * 1000),
            isActive: true,
            userLocation: getRandomElement(['New York', 'London', 'Tokyo', 'Berlin', 'Paris'])
        });
    }
    
    // Статистика авторов
    if (!authorStats[authorName]) {
        authorStats[authorName] = {
            articles: 0,
            totalViews: 0,
            totalLikes: 0,
            totalShares: 0,
            categories: new Set()
        };
    }
    authorStats[authorName].articles++;
    authorStats[authorName].totalViews += views;
    authorStats[authorName].totalLikes += likes;
    authorStats[authorName].totalShares += shares;
    authorStats[authorName].categories.add(category);
    
    // Статистика категорий
    categoryStats[category] = (categoryStats[category] || 0) + 1;
    
    if (i % 100 === 0) print(`  Generated ${i} articles...`);
}

// Вставляем новости
print('Inserting news articles...');
const newsResult = db.news.insertMany(newsDocuments);
print(`✅ News articles inserted: ${newsResult.insertedCount}`);

// Вставляем комментарии
print('Inserting comments...');
const commentsResult = db.comments.insertMany(commentsDocuments);
print(`✅ Comments inserted: ${commentsResult.insertedCount}`);

// Обновляем счетчики комментариев в новостях
print('Updating comment counts in news...');
const allNews = db.news.find().toArray();
for (const news of allNews) {
    const commentCount = db.comments.countDocuments({ articleTitle: news.title });
    db.news.updateOne(
        { _id: news._id },
        { 
            $set: { 
                "metrics.comments": commentCount,
                "metrics.engagementRate": parseFloat(((news.metrics.likes + commentCount) / news.metrics.views * 100).toFixed(2))
            } 
        }
    );
}

// Создаем статистику авторов
print('Creating authors statistics...');
const authorDocs = Object.entries(authorStats).map(([name, stats]) => ({
    authorName: `Author_${name} LastName_${name}`,
    authorEmail: `author${name}@news.com`,
    totalArticles: stats.articles,
    totalViews: stats.totalViews,
    totalLikes: stats.totalLikes,
    totalShares: stats.totalShares,
    avgViewsPerArticle: Math.round(stats.totalViews / stats.articles),
    avgEngagementRate: parseFloat((stats.totalLikes / stats.totalViews * 100).toFixed(2)),
    categories: Array.from(stats.categories),
    performanceScore: Math.round(stats.totalViews / stats.articles),
    lastArticleDate: new Date(),
    isActive: true,
    joinedDate: new Date(2023, 0, getRandomInt(1, 365))
}));

db.authors_stats.insertMany(authorDocs);
print(`✅ Authors statistics inserted: ${authorDocs.length}`);

// Создаем категории
print('Creating categories...');
const categoryDocs = Object.entries(categoryStats).map(([name, count]) => ({
    name: name,
    description: `${name.charAt(0).toUpperCase() + name.slice(1)} news and updates`,
    articleCount: count,
    lastUpdated: new Date(),
    isActive: true,
    featured: ['politics', 'technology', 'sports'].includes(name)
}));

db.categories.insertMany(categoryDocs);
print(`✅ Categories inserted: ${categoryDocs.length}`);
print('\n=== РЕАЛИЗАЦИЯ СВЯЗЕЙ МЕЖДУ КОЛЛЕКЦИЯМИ (1:N и M:N) ===');
print('Создаём 1:N связь: news → comments (массив commentIds в news)');
let bulkOps = [];
db.news.find({}, { title: 1 }).forEach(function(news) {
    const commentIds = db.comments
        .find({ articleTitle: news.title }, { _id: 1 })
        .map(c => c._id);

    if (commentIds.length > 0) {
        bulkOps.push({
            updateOne: {
                filter: { _id: news._id },
                update: { $set: { commentIds: commentIds } }
            }
        });
    }

    // Пакетная отправка каждые 500 документов
    if (bulkOps.length >= 500) {
        db.news.bulkWrite(bulkOps);
        bulkOps = [];
    }
});
if (bulkOps.length > 0) db.news.bulkWrite(bulkOps);
print('1:N связь создана (поле commentIds в news)');
print('Создаём M:N связь: authors ↔ news (поле newsIds в authors_stats)');
db.authors_stats.find().forEach(function(author) {
    // Ищем новости ТОЛЬКО по email — это 100% уникально
    const newsIds = db.news
        .find({ "author.email": author.authorEmail })
        .map(function(doc) { return doc._id; });  // <-- ВАЖНО: НЕ toArray()!

    if (newsIds.length > 0) {
        db.authors_stats.updateOne(
            { _id: author._id },
            { $set: { newsIds: newsIds } }
        );
    }
});
print('M:N связь создана (поле newsIds в authors_stats)');

// ОБОСНОВАНИЕ ВЫБОРА (можно скопировать в отчёт):
print('\nОБОСНОВАНИЕ АРХИТЕКТУРНЫХ РЕШЕНИЙ:');
print('1:N (news → comments):');
print('   → Использованы ССЫЛКИ (manual references)');
print('   → Причина: комментарии добавляются динамически, частые обновления');
print('   → Встраивание привело бы к превышению 16 МБ лимита документа');
print('');
print('M:N (authors ↔ news):');
print('   → Использовано ВСТРАИВАНИЕ (newsIds в authors_stats)');
print('   → Причина: статистика автора читается целиком при аналитике');
print('   → Редко меняется, денормализация ускоряет чтение топ-авторов');
print('   → Упрощает $lookup и отчёты по авторам');
print('');
print('✅ M:N relations set (news IDs embedded in authors_stats)');
// Финальная статистика
print('\n=== 📊 SEED DATA COMPLETED ===');
print(`📰 News articles: ${db.news.countDocuments()}`);
print(`💬 Comments: ${db.comments.countDocuments()}`);
print(`👤 Authors stats: ${db.authors_stats.countDocuments()}`);
print(`📂 Categories: ${db.categories.countDocuments()}`);
print(`🎯 Total documents: ${db.news.countDocuments() + db.comments.countDocuments() + db.authors_stats.countDocuments() + db.categories.countDocuments()}`);

// Детальная статистика
print('\n📈 Articles by category:');
const stats = db.news.aggregate([
    { $group: { _id: "$category", count: { $sum: 1 } } },
    { $sort: { count: -1 } }
]).toArray();

stats.forEach(stat => {
    print(`   ${stat._id}: ${stat.count} articles`);
});

print('\n🎉 Complete seed data loaded successfully!');