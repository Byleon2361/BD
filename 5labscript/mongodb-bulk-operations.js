// mongodb-bulk-operations.js
// Реализация bulk-операций с BulkWrite()

const { MongoClient } = require('mongodb');

const MONGODB_URI = 'mongodb://news_user:news_password123@localhost:27017/news_aggregator?authSource=news_aggregator';

class BulkOperationsManager {
    constructor() {
        this.client = null;
        this.db = null;
    }
    
    async connect() {
        this.client = new MongoClient(MONGODB_URI);
        await this.client.connect();
        this.db = this.client.db('news_aggregator');
        console.log('✅ Подключено к MongoDB для bulk-операций');
    }
    
    async disconnect() {
        if (this.client) {
            await this.client.close();
        }
    }
    
    // BULK-ОПЕРАЦИЯ 1: Массовое обновление просмотров новостей
    async bulkUpdateNewsViews() {
        console.log('\n📊 BULK-ОПЕРАЦИЯ 1: Массовое обновление просмотров новостей');
        
        try {
            // Получаем случайные 50 новостей
            const randomNews = await this.db.collection('news')
                .aggregate([{ $sample: { size: 50 } }])
                .toArray();
            
            if (randomNews.length === 0) {
                console.log('❌ Нет новостей для обновления');
                return;
            }
            
            console.log(`   Найдено новостей для обновления: ${randomNews.length}`);
            
            // Создаем bulk-операции
            const bulkOps = randomNews.map((news, index) => {
                // Добавляем случайное количество просмотров (100-1000)
                const viewsToAdd = Math.floor(Math.random() * 900) + 100;
                
                return {
                    updateOne: {
                        filter: { _id: news._id },
                        update: {
                            $inc: { 'metrics.views': viewsToAdd },
                            $set: { 
                                'metrics.updatedAt': new Date(),
                                'metadata.lastViewUpdate': new Date()
                            }
                        }
                    }
                };
            });
            
            // Выполняем bulk-операцию
            console.log('   Выполняем bulk-операцию...');
            const startTime = Date.now();
            
            const result = await this.db.collection('news').bulkWrite(bulkOps, {
                ordered: false, // Параллельное выполнение для скорости
                writeConcern: { w: 1 }
            });
            
            const endTime = Date.now();
            const duration = endTime - startTime;
            
            console.log('   📈 Результаты bulk-операции:');
            console.log(`      Обновлено документов: ${result.modifiedCount}`);
            console.log(`      Совпало документов: ${result.matchedCount}`);
            console.log(`      Время выполнения: ${duration}ms`);
            console.log(`      Среднее время на операцию: ${(duration / bulkOps.length).toFixed(2)}ms`);
            
            return result;
            
        } catch (error) {
            console.error('❌ Ошибка при массовом обновлении просмотров:', error.message);
            throw error;
        }
    }
    
    // BULK-ОПЕРАЦИЯ 2: Пакетное добавление тегов к новостям
    async bulkAddTagsToNews() {
        console.log('\n🏷️  BULK-ОПЕРАЦИЯ 2: Пакетное добавление тегов к новостям');
        
        try {
            // Получаем 30 новостей без тегов или с малым количеством тегов
            const newsWithoutTags = await this.db.collection('news')
                .find({ 
                    $or: [
                        { 'metadata.tagIds': { $exists: false } },
                        { 'metadata.tagIds': { $size: 0 } },
                        { 'metadata.tagIds': { $size: 1 } }
                    ]
                })
                .limit(30)
                .toArray();
            
            if (newsWithoutTags.length === 0) {
                console.log('❌ Все новости уже имеют теги');
                return;
            }
            
            console.log(`   Найдено новостей без тегов/с малым количеством тегов: ${newsWithoutTags.length}`);
            
            // Получаем все доступные теги
            const allTags = await this.db.collection('tags').find({}).toArray();
            
            if (allTags.length === 0) {
                console.log('❌ Нет доступных тегов');
                return;
            }
            
            console.log(`   Доступных тегов: ${allTags.length}`);
            
            // Создаем bulk-операции
            const bulkOps = [];
            
            for (const news of newsWithoutTags) {
                // Выбираем случайные 2-3 тега
                const tagCount = Math.floor(Math.random() * 2) + 2;
                const selectedTags = [...allTags]
                    .sort(() => 0.5 - Math.random())
                    .slice(0, tagCount);
                
                const tagIds = selectedTags.map(tag => tag._id);
                const tagNames = selectedTags.map(tag => tag.name);
                
                bulkOps.push({
                    updateOne: {
                        filter: { _id: news._id },
                        update: {
                            $set: { 
                                'metadata.tagIds': tagIds,
                                'metadata.tagNames': tagNames,
                                'metadata.tagsUpdatedAt': new Date()
                            }
                        }
                    }
                });
                
                // Также обновляем счетчики использования тегов
                for (const tag of selectedTags) {
                    bulkOps.push({
                        updateOne: {
                            filter: { _id: tag._id },
                            update: { $inc: { usageCount: 1 } }
                        }
                    });
                }
            }
            
            console.log(`   Создано операций: ${bulkOps.length}`);
            console.log('   Выполняем bulk-операцию...');
            
            const startTime = Date.now();
            const result = await this.db.collection('news').bulkWrite(bulkOps, {
                ordered: false
            });
            const endTime = Date.now();
            
            console.log('   📈 Результаты bulk-операции:');
            console.log(`      Обновлено новостей: ${result.modifiedCount}`);
            console.log(`      Время выполнения: ${endTime - startTime}ms`);
            
            return result;
            
        } catch (error) {
            console.error('❌ Ошибка при добавлении тегов:', error.message);
            throw error;
        }
    }
    
    // BULK-ОПЕРАЦИЯ 3: Массовое деактивирование старых новостей
    async bulkDeactivateOldNews() {
        console.log('\n🗑️  BULK-ОПЕРАЦИЯ 3: Массовое деактивирование старых новостей');
        
        try {
            // Находим новости старше 1 года с низкой вовлеченностью
            const oneYearAgo = new Date();
            oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
            
            const oldNews = await this.db.collection('news')
                .find({
                    'metadata.publishDate': { $lt: oneYearAgo },
                    'metadata.isActive': true,
                    'metrics.views': { $lt: 1000 } // Мало просмотров
                })
                .limit(100)
                .toArray();
            
            if (oldNews.length === 0) {
                console.log('❌ Нет старых новостей для деактивации');
                return;
            }
            
            console.log(`   Найдено старых новостей для деактивации: ${oldNews.length}`);
            
            // Создаем операции разных типов
            const bulkOps = [];
            
            oldNews.forEach((news, index) => {
                // Первые 30 - деактивируем
                if (index < 30) {
                    bulkOps.push({
                        updateOne: {
                            filter: { _id: news._id },
                            update: {
                                $set: { 
                                    'metadata.isActive': false,
                                    'status': 'archived',
                                    'metadata.archivedAt': new Date()
                                }
                            }
                        }
                    });
                }
                // Следующие 20 - помечаем как устаревшие
                else if (index < 50) {
                    bulkOps.push({
                        updateOne: {
                            filter: { _id: news._id },
                            update: {
                                $set: { 
                                    'metadata.isOutdated': true,
                                    'metadata.outdatedAt': new Date()
                                },
                                $push: { 
                                    'metadata.tags': 'outdated',
                                    'metadata.tagNames': 'outdated'
                                }
                            }
                        }
                    });
                }
                // Остальные - увеличиваем просмотры (симуляция активности)
                else {
                    bulkOps.push({
                        updateOne: {
                            filter: { _id: news._id },
                            update: {
                                $inc: { 'metrics.views': 500 },
                                $set: { 'metadata.lastBoost': new Date() }
                            }
                        }
                    });
                }
            });
            
            console.log(`   Создано операций разных типов: ${bulkOps.length}`);
            
            // Выполняем bulk-операцию с разными типами операций
            const startTime = Date.now();
            const result = await this.db.collection('news').bulkWrite(bulkOps, {
                ordered: false
            });
            const endTime = Date.now();
            
            console.log('   📈 Результаты смешанной bulk-операции:');
            console.log(`      Всего операций: ${bulkOps.length}`);
            console.log(`      Модифицировано: ${result.modifiedCount}`);
            console.log(`      Совпало: ${result.matchedCount}`);
            console.log(`      Время: ${endTime - startTime}ms`);
            
            // Детальная статистика
            console.log('\n   📊 Детали по типам операций:');
            console.log(`      Деактивировано новостей: 30`);
            console.log(`      Помечено устаревшими: 20`);
            console.log(`      Увеличено просмотров: ${oldNews.length - 50}`);
            
            return result;
            
        } catch (error) {
            console.error('❌ Ошибка при деактивации новостей:', error.message);
            throw error;
        }
    }
    
    // BULK-ОПЕРАЦИЯ 4: Пакетное создание комментариев
    async bulkCreateComments() {
        console.log('\n💬 BULK-ОПЕРАЦИЯ 4: Пакетное создание комментариев');
        
        try {
            // Получаем 20 популярных новостей
            const popularNews = await this.db.collection('news')
                .find({ 'metrics.views': { $gt: 1000 } })
                .sort({ 'metrics.views': -1 })
                .limit(20)
                .toArray();
            
            if (popularNews.length === 0) {
                console.log('❌ Нет популярных новостей для комментариев');
                return;
            }
            
            console.log(`   Найдено популярных новостей: ${popularNews.length}`);
            
            // Генерируем комментарии
            const comments = [];
            const users = ['john_doe', 'jane_smith', 'alex_w', 'tech_guru', 'news_fan', 'ai_enthusiast'];
            const commentTemplates = [
                "Great article! Really enjoyed reading this.",
                "Interesting perspective on the topic.",
                "This needs more research in my opinion.",
                "Can't wait to see more on this subject.",
                "Well written and informative.",
                "I disagree with some points but overall good.",
                "Thanks for sharing this information.",
                "Looking forward to the follow-up piece."
            ];
            
            // Создаем по 3-5 комментариев на каждую новость
            popularNews.forEach(news => {
                const commentCount = Math.floor(Math.random() * 3) + 3;
                
                for (let i = 0; i < commentCount; i++) {
                    comments.push({
                        articleId: news._id,
                        articleTitle: news.title,
                        user: users[Math.floor(Math.random() * users.length)],
                        comment: commentTemplates[Math.floor(Math.random() * commentTemplates.length)] + 
                                ` This is comment ${i + 1} on "${news.title.substring(0, 20)}..."`,
                        likes: Math.floor(Math.random() * 50),
                        timestamp: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000), // Последние 7 дней
                        isActive: true,
                        userLocation: ['New York', 'London', 'Tokyo', 'Berlin', 'Paris'][Math.floor(Math.random() * 5)],
                        createdAt: new Date()
                    });
                }
            });
            
            console.log(`   Сгенерировано комментариев: ${comments.length}`);
            
            // Bulk insert комментариев
            const startTime = Date.now();
            const result = await this.db.collection('comments').insertMany(comments, {
                ordered: false
            });
            const endTime = Date.now();
            
            console.log(`   📈 Результаты bulk-insert:`);
            console.log(`      Вставлено комментариев: ${result.insertedCount}`);
            console.log(`      Время выполнения: ${endTime - startTime}ms`);
            console.log(`      Средняя скорость: ${(comments.length / ((endTime - startTime) / 1000)).toFixed(2)} документов/секунду`);
            
            // Обновляем счетчики комментариев в новостях (отдельная bulk-операция)
            const updateOps = [];
            
            for (const news of popularNews) {
                const newsComments = comments.filter(c => c.articleId.equals(news._id));
                
                if (newsComments.length > 0) {
                    updateOps.push({
                        updateOne: {
                            filter: { _id: news._id },
                            update: {
                                $inc: { 'metrics.comments': newsComments.length },
                                $addToSet: { 
                                    'metadata.commentIds': { 
                                        $each: newsComments.map(c => c._id) 
                                    }
                                }
                            }
                        }
                    });
                }
            }
            
            if (updateOps.length > 0) {
                console.log(`   Обновляем счетчики в ${updateOps.length} новостях...`);
                const updateResult = await this.db.collection('news').bulkWrite(updateOps, {
                    ordered: false
                });
                console.log(`      Обновлено новостей: ${updateResult.modifiedCount}`);
            }
            
            return result;
            
        } catch (error) {
            console.error('❌ Ошибка при создании комментариев:', error.message);
            throw error;
        }
    }
    
    // BULK-ОПЕРАЦИЯ 5: Смешанные операции для демонстрации
    async demonstrateMixedBulkOperations() {
        console.log('\n🎯 BULK-ОПЕРАЦИЯ 5: Смешанные операции (демонстрация BulkWrite)');
        console.log('='.repeat(60));
        
        try {
            // Получаем несколько документов для операций
            const sampleNews = await this.db.collection('news')
                .find({})
                .limit(10)
                .toArray();
            
            if (sampleNews.length < 3) {
                console.log('❌ Недостаточно данных для демонстрации');
                return;
            }
            
            // Создаем смешанные bulk-операции
            const mixedBulkOps = [];
            
            // 1. INSERT - новая временная запись
            mixedBulkOps.push({
                insertOne: {
                    document: {
                        title: "Temporary Test Article - Bulk Operations Demo",
                        content: "This article demonstrates MongoDB bulk operations capabilities.",
                        category: "technology",
                        metadata: {
                            isTemporary: true,
                            createdAt: new Date(),
                            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 часа
                        },
                        status: "draft"
                    }
                }
            });
            
            // 2. UPDATE - обновление просмотров
            mixedBulkOps.push({
                updateOne: {
                    filter: { _id: sampleNews[0]._id },
                    update: {
                        $inc: { 'metrics.views': 100 },
                        $set: { 'metadata.lastBulkUpdate': new Date() }
                    }
                }
            });
            
            // 3. UPDATE с массивом
            mixedBulkOps.push({
                updateOne: {
                    filter: { _id: sampleNews[1]._id },
                    update: {
                        $push: { 
                            'metadata.tags': 'bulk_updated',
                            'metadata.tagNames': 'bulk_updated'
                        }
                    }
                }
            });
            
            // 4. REPLACE - замена документа
            mixedBulkOps.push({
                replaceOne: {
                    filter: { _id: sampleNews[2]._id },
                    replacement: {
                        ...sampleNews[2],
                        metadata: {
                            ...sampleNews[2].metadata,
                            bulkReplaced: true,
                            replacedAt: new Date()
                        }
                    }
                }
            });
            
            // 5. DELETE - удаление временных записей
            mixedBulkOps.push({
                deleteOne: {
                    filter: { 'metadata.isTemporary': true, 'metadata.expiresAt': { $lt: new Date() } }
                }
            });
            
            // 6. UPDATE MANY - массовое обновление
            mixedBulkOps.push({
                updateMany: {
                    filter: { category: { $in: ['technology', 'science'] } },
                    update: {
                        $inc: { 'metrics.likes': 10 },
                        $set: { 'metadata.bulkCategoryUpdate': new Date() }
                    }
                }
            });
            
            // 7. DELETE MANY - удаление старых записей (условно)
            mixedBulkOps.push({
                deleteMany: {
                    filter: { 
                        'metadata.isTemporary': true,
                        'metadata.createdAt': { $lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
                    }
                }
            });
            
            console.log(`   Создано смешанных операций: ${mixedBulkOps.length} типов`);
            console.log('   Типы операций: insertOne, updateOne, replaceOne, deleteOne, updateMany, deleteMany');
            
            // Выполняем смешанную bulk-операцию
            console.log('\n   🚀 Выполняем смешанную bulk-операцию...');
            const startTime = Date.now();
            
            const result = await this.db.collection('news').bulkWrite(mixedBulkOps, {
                ordered: false, // Важно: unordered для смешанных операций
                writeConcern: { w: 1 },
                bypassDocumentValidation: false
            });
            
            const endTime = Date.now();
            
            console.log('\n   📊 РЕЗУЛЬТАТЫ СМЕШАННОЙ BULK-ОПЕРАЦИИ:');
            console.log('   ' + '─'.repeat(40));
            console.log(`   Вставлено (insertOne): ${result.insertedCount || 0}`);
            console.log(`   Совпало для updateOne: ${result.matchedCount || 0}`);
            console.log(`   Модифицировано updateOne: ${result.modifiedCount || 0}`);
            console.log(`   Совпало для updateMany: ${result.upsertedCount || 0}`);
            console.log(`   Удалено deleteOne: ${result.deletedCount || 0}`);
            console.log(`   Удалено deleteMany: ${result.deletedCount || 0}`);
            console.log(`   Заменено replaceOne: ${result.upsertedCount || 0}`);
            console.log('   ' + '─'.repeat(40));
            console.log(`   Общее время выполнения: ${endTime - startTime}ms`);
            
            // Показываем статистику по каждой операции
            console.log('\n   🔍 ДЕТАЛИ ОПЕРАЦИЙ:');
            console.log(`      1. insertOne: ${result.insertedCount > 0 ? '✅ Успешно' : '❌ Не выполнена'}`);
            console.log(`      2. updateOne: ${result.modifiedCount > 0 ? '✅ Успешно' : '❌ Не выполнена'}`);
            console.log(`      3. updateOne с $push: ${result.modifiedCount > 1 ? '✅ Успешно' : '❌ Не выполнена'}`);
            console.log(`      4. replaceOne: ${result.upsertedCount > 0 ? '✅ Успешно' : '❌ Не выполнена'}`);
            console.log(`      5. deleteOne: ${result.deletedCount > 0 ? '✅ Успешно' : '❌ Не выполнена'}`);
            console.log(`      6. updateMany: ${result.matchedCount > 1 ? '✅ Успешно' : '❌ Не выполнена'}`);
            console.log(`      7. deleteMany: ${result.deletedCount > 1 ? '✅ Успешно' : '❌ Не выполнена'}`);
            
            return result;
            
        } catch (error) {
            console.error('❌ Ошибка в смешанных операциях:', error.message);
            
            // Детализация ошибок для bulk-операций
            if (error.writeErrors) {
                console.error('   Ошибки записи:');
                error.writeErrors.forEach((err, idx) => {
                    console.error(`     ${idx + 1}. Операция ${err.op}: ${err.errmsg}`);
                });
            }
            
            throw error;
        }
    }
    
    // Основная функция демонстрации
    async demonstrateAllBulkOperations() {
        await this.connect();
        
        console.log('=== ДЕМОНСТРАЦИЯ BULK-ОПЕРАЦИЙ MONGODB ===\n');
        
        try {
            // 1. Массовое обновление просмотров
            await this.bulkUpdateNewsViews();
            
            // 2. Пакетное добавление тегов
            await this.bulkAddTagsToNews();
            
            // 3. Деактивация старых новостей
            await this.bulkDeactivateOldNews();
            
            // 4. Создание комментариев
            await this.bulkCreateComments();
            
            // 5. Смешанные операции
            await this.demonstrateMixedBulkOperations();
            
            console.log('\n' + '='.repeat(60));
            console.log('🎉 ВСЕ BULK-ОПЕРАЦИИ УСПЕШНО ВЫПОЛНЕНЫ!');
            console.log('='.repeat(60));
            
        } catch (error) {
            console.error('❌ Общая ошибка при выполнении bulk-операций:', error.message);
        } finally {
            await this.disconnect();
        }
    }
}

// Запуск демонстрации
if (require.main === module) {
    const manager = new BulkOperationsManager();
    
    manager.demonstrateAllBulkOperations().then(() => {
        console.log('\n✅ Демонстрация bulk-операций завершена!');
        process.exit(0);
    }).catch(err => {
        console.error('❌ Ошибка:', err);
        process.exit(1);
    });
}

module.exports = { BulkOperationsManager };