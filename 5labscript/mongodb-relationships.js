// mongodb-relationships.js
// Реализация связей между коллекциями (1:N, M:N)

const { MongoClient } = require('mongodb');

const MONGODB_URI = 'mongodb://news_user:news_password123@localhost:27017/news_aggregator?authSource=news_aggregator';

async function setupRelationships() {
    const client = new MongoClient(MONGODB_URI);
    
    try {
        await client.connect();
        const db = client.db('news_aggregator');
        
        console.log('=== НАСТРОЙКА СВЯЗЕЙ МЕЖДУ КОЛЛЕКЦИЯМИ ===\n');
        
        // 1. ПОДГОТОВКА: СОЗДАЕМ КОЛЛЕКЦИЮ ТЕГОВ ДЛЯ M:N СВЯЗИ
        console.log('1. Создаем коллекцию тегов для связи M:N...');
        
        await db.collection('tags').deleteMany({});
        
        const tagsData = [
            { name: 'politics', description: 'Political topics', usageCount: 0, createdAt: new Date() },
            { name: 'sports', description: 'Sports events', usageCount: 0, createdAt: new Date() },
            { name: 'technology', description: 'Tech innovations', usageCount: 0, createdAt: new Date() },
            { name: 'ai', description: 'Artificial Intelligence', usageCount: 0, createdAt: new Date() },
            { name: 'business', description: 'Business news', usageCount: 0, createdAt: new Date() },
            { name: 'health', description: 'Healthcare', usageCount: 0, createdAt: new Date() },
            { name: 'science', description: 'Scientific discoveries', usageCount: 0, createdAt: new Date() },
            { name: 'breaking', description: 'Breaking news', usageCount: 0, createdAt: new Date() },
            { name: 'exclusive', description: 'Exclusive content', usageCount: 0, createdAt: new Date() },
            { name: 'analysis', description: 'In-depth analysis', usageCount: 0, createdAt: new Date() }
        ];
        
        await db.collection('tags').insertMany(tagsData);
        console.log(`✅ Коллекция tags создана: ${tagsData.length} тегов`);
        
        // 2. ОБНОВЛЯЕМ НОВОСТИ ДЛЯ СВЯЗИ M:N С ТЕГАМИ
        console.log('\n2. Обновляем новости для связи M:N с тегами...');
        
        // Сначала получаем все новости
        const allNews = await db.collection('news').find({}).toArray();
        
        // Обновляем каждую новость с массивами tagIds
        for (const news of allNews) {
            // Получаем случайные 2-4 тега
            const allTags = await db.collection('tags').find({}).toArray();
            const randomTags = allTags.sort(() => 0.5 - Math.random()).slice(0, Math.floor(Math.random() * 3) + 2);
            
            const tagIds = randomTags.map(tag => tag._id);
            const tagNames = randomTags.map(tag => tag.name);
            
            // Обновляем новость
            await db.collection('news').updateOne(
                { _id: news._id },
                { 
                    $set: { 
                        'metadata.tagIds': tagIds,
                        'metadata.tagNames': tagNames
                    } 
                }
            );
            
            // Обновляем счетчики использования тегов
            for (const tagId of tagIds) {
                await db.collection('tags').updateOne(
                    { _id: tagId },
                    { $inc: { usageCount: 1 } }
                );
            }
        }
        
        console.log(`✅ Новости обновлены с M:N связью с тегами: ${allNews.length} документов`);
        
        // 3. ОБНОВЛЯЕМ КОММЕНТАРИИ ДЛЯ СВЯЗИ 1:N
        console.log('\n3. Настраиваем связь 1:N между новостями и комментариями...');
        
        // Обновляем комментарии для связи с новостями
        const comments = await db.collection('comments').find({}).toArray();
        
        for (const comment of comments) {
            // Находим новость по заголовку (существующая логика)
            const news = await db.collection('news').findOne({ title: comment.articleTitle });
            
            if (news) {
                // Обновляем комментарий с ссылкой на новость
                await db.collection('comments').updateOne(
                    { _id: comment._id },
                    { 
                        $set: { 
                            articleId: news._id,
                            articleTitle: news.title // сохраняем для обратной совместимости
                        } 
                    }
                );
                
                // Встраиваем ID комментария в новость (опционально - пример встраивания)
                await db.collection('news').updateOne(
                    { _id: news._id },
                    { 
                        $addToSet: { 
                            'metadata.commentIds': comment._id 
                        } 
                    }
                );
            }
        }
        
        console.log(`✅ Комментарии обновлены с 1:N связью: ${comments.length} комментариев`);
        
        // 4. СОЗДАЕМ КОЛЛЕКЦИЮ USER_REACTIONS ДЛЯ M:N СВЯЗИ ПОЛЬЗОВАТЕЛИ-НОВОСТИ
        console.log('\n4. Создаем коллекцию user_reactions для M:N связи пользователи-новости...');
        
        await db.collection('user_reactions').deleteMany({});
        
        const reactionsData = [];
        const userIds = ['user1', 'user2', 'user3', 'user4', 'user5', 'user6', 'user7', 'user8', 'user9', 'user10'];
        const reactionTypes = ['like', 'save', 'share', 'report'];
        
        // Создаем 100 случайных реакций
        for (let i = 0; i < 100; i++) {
            const randomNews = allNews[Math.floor(Math.random() * allNews.length)];
            const randomUser = userIds[Math.floor(Math.random() * userIds.length)];
            const randomReaction = reactionTypes[Math.floor(Math.random() * reactionTypes.length)];
            
            reactionsData.push({
                userId: randomUser,
                articleId: randomNews._id,
                reactionType: randomReaction,
                createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000), // последние 30 дней
                metadata: {
                    device: ['mobile', 'desktop', 'tablet'][Math.floor(Math.random() * 3)],
                    location: ['US', 'UK', 'DE', 'FR', 'JP'][Math.floor(Math.random() * 5)]
                }
            });
        }
        
        await db.collection('user_reactions').insertMany(reactionsData);
        console.log(`✅ Коллекция user_reactions создана: ${reactionsData.length} реакций`);
        
        // 5. ОБОСНОВАНИЕ ВЫБОРА СТРАТЕГИЙ
        console.log('\n=== ОБОСНОВАНИЕ ВЫБОРА СТРАТЕГИЙ ===');
        console.log('\n1. Связь 1:N (новости → комментарии):');
        console.log('   ✅ Выбрана ГИБРИДНАЯ стратегия:');
        console.log('      - Встраивание: commentIds в новостях (для быстрого доступа)');
        console.log('      - Ссылки: articleId в комментариях (для масштабирования)');
        console.log('   Почему: Комментарии могут быть очень объемными, но их количество нужно знать для каждой новости.');
        
        console.log('\n2. Связь M:N (новости ↔ теги):');
        console.log('   ✅ Выбрана стратегия ССЫЛОК:');
        console.log('      - Отдельная коллекция tags');
        console.log('      - Массивы tagIds и tagNames в новостях');
        console.log('      - Счетчики использования в тегах');
        console.log('   Почему: Теги используются многими новостями, нужно централизованное управление.');
        
        console.log('\n3. Связь M:N (пользователи ↔ новости):');
        console.log('   ✅ Выбрана стратегия ПРОМЕЖУТОЧНОЙ КОЛЛЕКЦИИ:');
        console.log('      - user_reactions соединяет users и news');
        console.log('      - Хранит тип реакции и метаданные');
        console.log('   Почему: Нужно хранить доп. данные о взаимодействии.');
        
        // 6. ПРОВЕРКА СВЯЗЕЙ
        console.log('\n=== ПРОВЕРКА СВЯЗЕЙ ===');
        
        // Проверка M:N: новости с тегами
        const newsWithTags = await db.collection('news').aggregate([
            { $match: { 'metadata.tagIds': { $exists: true, $ne: [] } } },
            { $sample: { size: 3 } },
            { 
                $lookup: {
                    from: 'tags',
                    localField: 'metadata.tagIds',
                    foreignField: '_id',
                    as: 'tagDetails'
                }
            },
            { $project: { title: 1, 'tagDetails.name': 1, 'metadata.tagNames': 1 } }
        ]).toArray();
        
        console.log('\n📌 Пример M:N связи (новости с тегами):');
        newsWithTags.forEach((news, idx) => {
            console.log(`   ${idx + 1}. "${news.title.substring(0, 30)}..."`);
            console.log(`      Теги: ${news.metadata.tagNames.join(', ')}`);
        });
        
        // Проверка 1:N: новость с комментариями
        const newsWithComments = await db.collection('news').aggregate([
            { $match: { 'metadata.commentIds': { $exists: true, $ne: [] } } },
            { $sample: { size: 1 } },
            { 
                $lookup: {
                    from: 'comments',
                    localField: 'metadata.commentIds',
                    foreignField: '_id',
                    as: 'comments'
                }
            },
            { $project: { title: 1, commentsCount: { $size: '$comments' }, comments: { $slice: ['$comments', 2] } } }
        ]).toArray();
        
        console.log('\n📌 Пример 1:N связи (новость с комментариями):');
        if (newsWithComments.length > 0) {
            console.log(`   "${newsWithComments[0].title.substring(0, 30)}..."`);
            console.log(`   Количество комментариев: ${newsWithComments[0].commentsCount}`);
            console.log(`   Примеры комментариев: ${newsWithComments[0].comments.map(c => c.comment.substring(0, 20) + '...').join(', ')}`);
        }
        
        // Проверка M:N через промежуточную коллекцию
        const userReactions = await db.collection('user_reactions').aggregate([
            { $sample: { size: 3 } },
            { 
                $lookup: {
                    from: 'news',
                    localField: 'articleId',
                    foreignField: '_id',
                    as: 'article'
                }
            },
            { 
                $lookup: {
                    from: 'tags',
                    localField: 'article.metadata.tagIds',
                    foreignField: '_id',
                    as: 'articleTags'
                }
            },
            { $unwind: '$article' },
            { $project: { userId: 1, reactionType: 1, 'article.title': 1, articleTags: { $slice: ['$articleTags', 2] } } }
        ]).toArray();
        
        console.log('\n📌 Пример M:N через промежуточную коллекцию (реакции пользователей):');
        userReactions.forEach((reaction, idx) => {
            console.log(`   ${idx + 1}. ${reaction.userId} ${reaction.reactionType}: "${reaction.article.title.substring(0, 30)}..."`);
        });
        
        console.log('\n✅ Все связи успешно настроены!');
        
    } catch (error) {
        console.error('❌ Ошибка при настройке связей:', error);
    } finally {
        await client.close();
    }
}

// Запуск
if (require.main === module) {
    setupRelationships().then(() => {
        console.log('\n🎉 Настройка связей завершена!');
        process.exit(0);
    }).catch(err => {
        console.error('Ошибка:', err);
        process.exit(1);
    });
}

module.exports = { setupRelationships };