// mongo-seed-big.js — БОЛЬШОЙ СИД: 10 000 статей для теста оптимизации

db = db.getSiblingDB('news_aggregator');

print('=== BIG SEED: Генерация 10 000 статей ===');

// Очищаем только news (остальные коллекции оставляем, если нужно)
db.news.deleteMany({});
db.comments.deleteMany({});  // очищаем комментарии, они пересоздадутся

const categories = ["politics", "sports", "technology", "entertainment", "business", "health", "science"];
const sources = [
    { name: "Reuters", website: "https://reuters.com", country: "International" },
    { name: "BBC News", website: "https://bbc.com", country: "UK" },
    { name: "CNN", website: "https://cnn.com", country: "USA" },
    { name: "Al Jazeera", website: "https://aljazeera.com", country: "Qatar" },
    { name: "Associated Press", website: "https://apnews.com", country: "USA" },
    { name: "The Guardian", website: "https://theguardian.com", country: "UK" }
];

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomDate(start, end) {
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function getTagsForCategory(category) {
    const baseTags = [category, 'news', 'latest', 'breaking'];
    const categoryTags = {
        technology: ['ai', 'innovation', 'tech', 'digital', 'software', 'machine-learning', 'gadgets', 'startup'],
        sports: ['football', 'competition', 'tournament', 'players', 'championship', 'olympics', 'match'],
        politics: ['government', 'election', 'policy', 'international', 'summit', 'diplomacy'],
        business: ['economy', 'market', 'finance', 'stocks', 'investment', 'company'],
        entertainment: ['movies', 'celebrities', 'music', 'awards', 'premiere', 'tv'],
        health: ['medicine', 'wellness', 'fitness', 'research', 'treatment', 'covid'],
        science: ['discovery', 'research', 'space', 'environment', 'climate', 'physics']
    };
    const specific = categoryTags[category] || [];
    return [...baseTags, ...specific.slice(0, getRandomInt(3, 7))];
}

const newsDocuments = [];
const commentsDocuments = [];
const startDate = new Date(2020, 0, 1);  // с 2020 для большего разброса дат
const endDate = new Date();

print('Генерация 10 000 статей и комментариев...');

for (let i = 1; i <= 10000; i++) {
    const category = categories[i % categories.length];
    const source = sources[i % sources.length];
    const authorId = getRandomInt(1, 100);  // больше авторов
    const authorName = `Author_${authorId} LastName_${authorId}`;
    
    const publishDate = getRandomDate(startDate, endDate);
    const views = getRandomInt(500, 100000);
    const likes = Math.floor(views * getRandomInt(1, 10) / 100);
    const shares = Math.floor(views * getRandomInt(1, 5) / 100);
    
    const title = `${category.charAt(0).toUpperCase() + category.slice(1)} News ${i}: Latest Developments`;
    
    const newsDoc = {
        title: title,
        content: `Detailed content for article ${i} about ${category}. Multiple paragraphs with analysis...`.repeat(10),
        category: category,
        source: source,
        author: {
            name: authorName,
            email: `author${authorId}@news.com`
        },
        metrics: {
            views: views,
            likes: likes,
            shares: shares,
            comments: 0
        },
        metadata: {
            publishDate: publishDate,
            isActive: true,
            tags: getTagsForCategory(category),
            language: "en"
        }
    };
    
    newsDocuments.push(newsDoc);
    
    // 1–5 комментариев на статью
    const commentCount = getRandomInt(1, 5);
    for (let j = 0; j < commentCount; j++) {
        commentsDocuments.push({
            articleTitle: title,
            user: `user${getRandomInt(1000, 99999)}`,
            comment: `Comment ${j+1} on article ${i}`,
            likes: getRandomInt(0, 50),
            timestamp: new Date(publishDate.getTime() + getRandomInt(1, 72) * 3600000)
        });
    }
    
    if (i % 2000 === 0) print(`   Сгенерировано ${i} статей...`);
}

// Вставка пакетами по 1000
print('Вставка 10 000 статей...');
for (let i = 0; i < newsDocuments.length; i += 1000) {
    db.news.insertMany(newsDocuments.slice(i, i + 1000));
    print(`   Вставлено ${i + 1000} статей`);
}

print('Вставка комментариев...');
for (let i = 0; i < commentsDocuments.length; i += 1000) {
    db.comments.insertMany(commentsDocuments.slice(i, i + 1000));
}

// Обновление счётчиков комментариев (опционально, но полезно)
print('Обновление счётчиков комментариев...');
db.news.find().forEach(function(doc) {
    const count = db.comments.countDocuments({ articleTitle: doc.title });
    if (count > 0) {
        db.news.updateOne({ _id: doc._id }, { $set: { "metrics.comments": count } });
    }
});

print(`\n✅ ГОТОВО! В коллекции news: ${db.news.countDocuments()} документов`);
print(`Комментарии: ${db.comments.countDocuments()}`);
print('Теперь запусти query-optimization.js — время COLLSCAN будет 50–300 мс, а после индексов 5–30 мс!');