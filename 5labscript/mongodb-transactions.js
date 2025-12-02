// mongodb-transactions.js
// Реализация многошаговых транзакций

const { MongoClient } = require('mongodb');

const MONGODB_URI = 'mongodb://news_user:news_password123@localhost:27017/news_aggregator?authSource=news_aggregator';

class NewsTransactionManager {
    constructor() {
        this.client = null;
        this.db = null;
    }
    
    async connect() {
        this.client = new MongoClient(MONGODB_URI);
        await this.client.connect();
        this.db = this.client.db('news_aggregator');
        console.log('✅ Подключено к MongoDB для транзакций');
    }
    
    async disconnect() {
        if (this.client) {
            await this.client.close();
            console.log('✅ Отключено от MongoDB');
        }
    }
    
    // ТРАНЗАКЦИЯ 1: Добавление новости с обновлением статистики
    async addNewsWithStatsTransaction(newsData) {
        const session = this.client.startSession();
        
        try {
            console.log('🚀 Начинаем транзакцию: Добавление новости с обновлением статистики');
            session.startTransaction({
                readConcern: { level: 'snapshot' },
                writeConcern: { w: 'majority' },
                readPreference: 'primary'
            });
            
            // Шаг 1: Генерируем уникальный hash
            const hash = this.generateHash(newsData.title + newsData.content);
            
            // Проверяем дубликат
            const existingNews = await this.db.collection('news')
                .findOne({ hash: hash }, { session });
            
            if (existingNews) {
                throw new Error('Новость с таким содержанием уже существует');
            }
            
            // Шаг 2: Добавляем новость
            const newsDocument = {
                ...newsData,
                hash: hash,
                metrics: {
                    views: 0,
                    likes: 0,
                    shares: 0,
                    comments: 0,
                    engagementRate: 0
                },
                metadata: {
                    ...newsData.metadata,
                    publishDate: new Date(),
                    isActive: true,
                    createdAt: new Date(),
                    updatedAt: new Date()
                },
                status: 'published'
            };
            
            const insertResult = await this.db.collection('news')
                .insertOne(newsDocument, { session });
            
            console.log(`   ✅ Новость добавлена: ${insertResult.insertedId}`);
            
            // Шаг 3: Обновляем статистику категории
            await this.db.collection('categories').updateOne(
                { name: newsData.category },
                { 
                    $inc: { articleCount: 1 },
                    $set: { lastUpdated: new Date() }
                },
                { session, upsert: true }
            );
            
            console.log(`   ✅ Статистика категории "${newsData.category}" обновлена`);
            
            // Шаг 4: Обновляем статистику автора
            const authorName = newsData.author?.name || 'Unknown Author';
            
            await this.db.collection('authors_stats').updateOne(
                { authorName: authorName },
                {
                    $inc: { 
                        totalArticles: 1,
                        totalViews: 0
                    },
                    $set: { 
                        lastArticleDate: new Date(),
                        updatedAt: new Date()
                    },
                    $addToSet: { categories: newsData.category }
                },
                { session, upsert: true }
            );
            
            console.log(`   ✅ Статистика автора "${authorName}" обновлена`);
            
            // Шаг 5: Обновляем теги (M:N связь)
            if (newsData.metadata?.tagIds && newsData.metadata.tagIds.length > 0) {
                await this.db.collection('tags').updateMany(
                    { _id: { $in: newsData.metadata.tagIds } },
                    { $inc: { usageCount: 1 } },
                    { session }
                );
                
                console.log(`   ✅ ${newsData.metadata.tagIds.length} тегов обновлены`);
            }
            
            // Фиксируем транзакцию
            await session.commitTransaction();
            console.log('✅ Транзакция успешно завершена!');
            
            return {
                success: true,
                newsId: insertResult.insertedId,
                hash: hash
            };
            
        } catch (error) {
            // Откатываем транзакцию при ошибке
            console.error('❌ Ошибка в транзакции:', error.message);
            
            if (session.inTransaction()) {
                await session.abortTransaction();
                console.log('↩️  Транзакция откатана');
            }
            
            return {
                success: false,
                error: error.message
            };
            
        } finally {
            await session.endSession();
        }
    }
    
    // ТРАНЗАКЦИЯ 2: Добавление комментария с обновлением счетчиков
    async addCommentWithUpdateTransaction(commentData) {
        const session = this.client.startSession();
        
        try {
            console.log('\n🚀 Начинаем транзакцию: Добавление комментария');
            session.startTransaction();
            
            // Шаг 1: Проверяем существование новости
            const news = await this.db.collection('news')
                .findOne({ _id: commentData.articleId }, { session });
            
            if (!news) {
                throw new Error('Новость не найдена');
            }
            
            // Шаг 2: Добавляем комментарий
            const commentDocument = {
                articleId: commentData.articleId,
                articleTitle: news.title,
                user: commentData.user,
                comment: commentData.comment,
                likes: 0,
                timestamp: new Date(),
                isActive: true,
                userLocation: commentData.userLocation || 'Unknown',
                createdAt: new Date()
            };
            
            const insertResult = await this.db.collection('comments')
                .insertOne(commentDocument, { session });
            
            console.log(`   ✅ Комментарий добавлен: ${insertResult.insertedId}`);
            
            // Шаг 3: Обновляем счетчик комментариев в новости
            await this.db.collection('news').updateOne(
                { _id: commentData.articleId },
                {
                    $inc: { 'metrics.comments': 1 },
                    $set: { 'metrics.updatedAt': new Date() },
                    $addToSet: { 'metadata.commentIds': insertResult.insertedId }
                },
                { session }
            );
            
            console.log(`   ✅ Счетчик комментариев в новости обновлен`);
            
            // Шаг 4: Пересчитываем engagement rate
            const updatedNews = await this.db.collection('news')
                .findOne({ _id: commentData.articleId }, { session });
            
            const engagementRate = ((updatedNews.metrics.likes + updatedNews.metrics.comments) / 
                                   (updatedNews.metrics.views || 1)) * 100;
            
            await this.db.collection('news').updateOne(
                { _id: commentData.articleId },
                {
                    $set: { 
                        'metrics.engagementRate': parseFloat(engagementRate.toFixed(2)),
                        'metadata.updatedAt': new Date()
                    }
                },
                { session }
            );
            
            console.log(`   ✅ Engagement rate пересчитан: ${engagementRate.toFixed(2)}%`);
            
            // Фиксируем транзакцию
            await session.commitTransaction();
            console.log('✅ Транзакция успешно завершена!');
            
            return {
                success: true,
                commentId: insertResult.insertedId
            };
            
        } catch (error) {
            console.error('❌ Ошибка в транзакции:', error.message);
            
            if (session.inTransaction()) {
                await session.abortTransaction();
                console.log('↩️  Транзакция откатана');
            }
            
            return {
                success: false,
                error: error.message
            };
            
        } finally {
            await session.endSession();
        }
    }
    
    // ТРАНЗАКЦИЯ 3: Удаление новости со всеми зависимостями
    async deleteNewsWithDependenciesTransaction(newsId) {
        const session = this.client.startSession();
        
        try {
            console.log('\n🚀 Начинаем транзакцию: Удаление новости с зависимостями');
            session.startTransaction();
            
            // Шаг 1: Получаем информацию о новости
            const news = await this.db.collection('news')
                .findOne({ _id: newsId }, { session });
            
            if (!news) {
                throw new Error('Новость не найдена');
            }
            
            console.log(`   📰 Удаляемая новость: "${news.title.substring(0, 30)}..."`);
            
            // Шаг 2: Уменьшаем счетчики категории
            if (news.category) {
                await this.db.collection('categories').updateOne(
                    { name: news.category },
                    { $inc: { articleCount: -1 } },
                    { session }
                );
                console.log(`   ✅ Счетчик категории "${news.category}" уменьшен`);
            }
            
            // Шаг 3: Уменьшаем счетчики автора
            if (news.author?.name) {
                await this.db.collection('authors_stats').updateOne(
                    { authorName: news.author.name },
                    { $inc: { totalArticles: -1, totalViews: -news.metrics.views } },
                    { session }
                );
                console.log(`   ✅ Статистика автора "${news.author.name}" обновлена`);
            }
            
            // Шаг 4: Уменьшаем счетчики тегов
            if (news.metadata?.tagIds && news.metadata.tagIds.length > 0) {
                await this.db.collection('tags').updateMany(
                    { _id: { $in: news.metadata.tagIds } },
                    { $inc: { usageCount: -1 } },
                    { session }
                );
                console.log(`   ✅ Счетчики ${news.metadata.tagIds.length} тегов уменьшены`);
            }
            
            // Шаг 5: Удаляем все комментарии к новости
            const deleteCommentsResult = await this.db.collection('comments')
                .deleteMany({ articleId: newsId }, { session });
            
            console.log(`   ✅ Удалено комментариев: ${deleteCommentsResult.deletedCount}`);
            
            // Шаг 6: Удаляем все реакции пользователей
            const deleteReactionsResult = await this.db.collection('user_reactions')
                .deleteMany({ articleId: newsId }, { session });
            
            console.log(`   ✅ Удалено реакций: ${deleteReactionsResult.deletedCount}`);
            
            // Шаг 7: Удаляем саму новость
            const deleteNewsResult = await this.db.collection('news')
                .deleteOne({ _id: newsId }, { session });
            
            console.log(`   ✅ Новость удалена: ${deleteNewsResult.deletedCount} документ`);
            
            // Фиксируем транзакцию
            await session.commitTransaction();
            console.log('✅ Транзакция успешно завершена!');
            
            return {
                success: true,
                deleted: {
                    news: 1,
                    comments: deleteCommentsResult.deletedCount,
                    reactions: deleteReactionsResult.deletedCount
                }
            };
            
        } catch (error) {
            console.error('❌ Ошибка в транзакции:', error.message);
            
            if (session.inTransaction()) {
                await session.abortTransaction();
                console.log('↩️  Транзакция откатана');
            }
            
            return {
                success: false,
                error: error.message
            };
            
        } finally {
            await session.endSession();
        }
    }
    
    // ТРАНЗАКЦИЯ 4: Массовое обновление просмотров с коррекцией статистики
    async bulkUpdateViewsTransaction(updates) {
        const session = this.client.startSession();
        
        try {
            console.log('\n🚀 Начинаем транзакцию: Массовое обновление просмотров');
            session.startTransaction();
            
            const results = [];
            
            for (const update of updates) {
                // Шаг 1: Обновляем просмотры в новости
                const newsUpdate = await this.db.collection('news').updateOne(
                    { _id: update.newsId },
                    { 
                        $inc: { 'metrics.views': update.viewsDelta },
                        $set: { 'metadata.updatedAt': new Date() }
                    },
                    { session }
                );
                
                // Шаг 2: Если новость обновлена, корректируем статистику автора
                if (newsUpdate.modifiedCount > 0) {
                    const news = await this.db.collection('news')
                        .findOne({ _id: update.newsId }, { session });
                    
                    if (news && news.author?.name) {
                        await this.db.collection('authors_stats').updateOne(
                            { authorName: news.author.name },
                            { $inc: { totalViews: update.viewsDelta } },
                            { session }
                        );
                    }
                }
                
                results.push({
                    newsId: update.newsId,
                    updated: newsUpdate.modifiedCount > 0,
                    viewsDelta: update.viewsDelta
                });
            }
            
            // Фиксируем транзакцию
            await session.commitTransaction();
            console.log(`✅ Транзакция успешно завершена! Обновлено: ${results.filter(r => r.updated).length} новостей`);
            
            return {
                success: true,
                results: results
            };
            
        } catch (error) {
            console.error('❌ Ошибка в транзакции:', error.message);
            
            if (session.inTransaction()) {
                await session.abortTransaction();
                console.log('↩️  Транзакция откатана');
            }
            
            return {
                success: false,
                error: error.message
            };
            
        } finally {
            await session.endSession();
        }
    }
    
    // Вспомогательная функция для генерации hash
    generateHash(content) {
        let hash = 0;
        for (let i = 0; i < content.length; i++) {
            const char = content.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(36);
    }
    
    // Демонстрация всех транзакций
    async demonstrateTransactions() {
        await this.connect();
        
        console.log('\n=== ДЕМОНСТРАЦИЯ ТРАНЗАКЦИЙ MONGODB ===\n');
        
        // Транзакция 1: Добавление новости
        console.log('1. ТРАНЗАКЦИЯ: Добавление новости');
        console.log('='.repeat(40));
        
        const newNewsData = {
            title: 'Breaking: New AI Model Breaks All Records',
            content: 'A revolutionary AI model has achieved unprecedented results in natural language processing...',
            category: 'technology',
            source: { name: 'TechNews', website: 'https://technews.com', country: 'USA' },
            author: { name: 'AI Researcher', email: 'ai@research.com' },
            metadata: {
                tags: ['ai', 'technology', 'breakthrough'],
                tagIds: [], // Будут заполнены автоматически
                readingTime: 5,
                wordCount: 350
            }
        };
        
        // Получаем теги для этой новости
        const aiTag = await this.db.collection('tags').findOne({ name: 'ai' });
        const techTag = await this.db.collection('tags').findOne({ name: 'technology' });
        
        if (aiTag && techTag) {
            newNewsData.metadata.tagIds = [aiTag._id, techTag._id];
        }
        
        const result1 = await this.addNewsWithStatsTransaction(newNewsData);
        console.log('Результат:', result1.success ? '✅ Успех' : '❌ Ошибка: ' + result1.error);
        
        // Транзакция 2: Добавление комментария (если новость добавлена)
        if (result1.success) {
            console.log('\n2. ТРАНЗАКЦИЯ: Добавление комментария');
            console.log('='.repeat(40));
            
            const commentData = {
                articleId: result1.newsId,
                user: 'tech_enthusiast',
                comment: 'This is amazing! Can\'t wait to try it out.',
                userLocation: 'San Francisco'
            };
            
            const result2 = await this.addCommentWithUpdateTransaction(commentData);
            console.log('Результат:', result2.success ? '✅ Успех' : '❌ Ошибка: ' + result2.error);
            
            // Транзакция 4: Массовое обновление просмотров
            console.log('\n4. ТРАНЗАКЦИЯ: Массовое обновление просмотров');
            console.log('='.repeat(40));
            
            // Получаем несколько случайных новостей
            const randomNews = await this.db.collection('news')
                .aggregate([{ $sample: { size: 3 } }])
                .toArray();
            
            const updates = randomNews.map(news => ({
                newsId: news._id,
                viewsDelta: Math.floor(Math.random() * 100) + 50
            }));
            
            const result4 = await this.bulkUpdateViewsTransaction(updates);
            console.log('Результат:', result4.success ? '✅ Успех' : '❌ Ошибка: ' + result4.error);
            
            if (result4.success) {
                console.log('Детали обновлений:');
                result4.results.forEach((r, i) => {
                    console.log(`   ${i + 1}. News ${r.newsId}: ${r.updated ? 'updated' : 'skipped'} (+${r.viewsDelta} views)`);
                });
            }
            
            // Транзакция 3: Удаление новости (опционально - для демонстрации)
            console.log('\n3. ТРАНЗАКЦИЯ: Удаление новости (пропускаем в демо)');
            console.log('='.repeat(40));
            console.log('⚠️  Транзакция удаления пропущена для сохранения данных');
            console.log('   Для теста используйте: await deleteNewsWithDependenciesTransaction(newsId)');
        }
        
        console.log('\n' + '='.repeat(50));
        console.log('🎉 ДЕМОНСТРАЦИЯ ТРАНЗАКЦИЙ ЗАВЕРШЕНА');
        console.log('='.repeat(50));
        
        await this.disconnect();
    }
}

// Запуск демонстрации
if (require.main === module) {
    const manager = new NewsTransactionManager();
    
    manager.demonstrateTransactions().then(() => {
        console.log('\n✅ Все транзакции выполнены!');
        process.exit(0);
    }).catch(err => {
        console.error('❌ Ошибка:', err);
        process.exit(1);
    });
}

module.exports = { NewsTransactionManager };