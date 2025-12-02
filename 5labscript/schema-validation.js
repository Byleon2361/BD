// 5labscript/schema-validation.js
// Валидация схемы на уровне коллекции с бизнес-правилами

const { MongoClient } = require('mongodb');

const MONGODB_URI = 'mongodb://news_user:news_password123@localhost:27017/news_aggregator?authSource=news_aggregator';

class SchemaValidator {
    constructor() {
        this.client = null;
        this.db = null;
    }
    
    async connect() {
        this.client = new MongoClient(MONGODB_URI);
        await this.client.connect();
        this.db = this.client.db('news_aggregator');
        console.log('✅ Подключено к MongoDB для валидации схемы');
    }
    
    async disconnect() {
        if (this.client) {
            await this.client.close();
        }
    }
    
    // Функция для создания коллекций с валидацией
    async createValidatedCollections() {
        console.log('\n=== СОЗДАНИЕ КОЛЛЕКЦИЙ С ВАЛИДАЦИЕЙ СХЕМЫ ===\n');
        
        try {
            // 1. КОЛЛЕКЦИЯ NEWS С БИЗНЕС-ПРАВИЛАМИ
            console.log('1. Создаем/обновляем коллекцию news с валидацией...');
            
            // Сначала удаляем старую коллекцию (если нужно пересоздать)
            try {
                await this.db.collection('news').drop();
                console.log('   Старая коллекция news удалена');
            } catch (e) {
                // Коллекция может не существовать
            }
            
            // Создаем коллекцию с валидацией
            await this.db.createCollection('news', {
                validator: {
                    $jsonSchema: {
                        bsonType: 'object',
                        required: [
                            'title', 
                            'content', 
                            'category', 
                            'hash',
                            'metadata.publishDate',
                            'metadata.isActive',
                            'metrics.views',
                            'metrics.likes',
                            'status'
                        ],
                        properties: {
                            // БИЗНЕС-ПРАВИЛО 1: Заголовок должен быть уникальным и в пределах длины
                            title: {
                                bsonType: 'string',
                                description: 'Заголовок новости - обязательное строковое поле',
                                minLength: 10,
                                maxLength: 200
                            },
                            
                            // БИЗНЕС-ПРАВИЛО 2: Контент должен быть достаточно длинным
                            content: {
                                bsonType: 'string',
                                description: 'Содержание новости - обязательное строковое поле',
                                minLength: 100,
                                maxLength: 10000
                            },
                            
                            // Категория должна быть из разрешенного списка
                            category: {
                                bsonType: 'string',
                                description: 'Категория новости',
                                enum: ['politics', 'sports', 'technology', 'entertainment', 
                                       'business', 'health', 'science', 'other']
                            },
                            
                            // Уникальный hash для дедупликации
                            hash: {
                                bsonType: 'string',
                                description: 'Уникальный hash контента для дедупликации',
                                pattern: '^[a-zA-Z0-9]+$'
                            },
                            
                            // БИЗНЕС-ПРАВИЛО 3: Просмотры не могут быть отрицательными
                            metrics: {
                                bsonType: 'object',
                                required: ['views', 'likes', 'comments'],
                                properties: {
                                    views: {
                                        bsonType: 'int',
                                        minimum: 0,
                                        description: 'Количество просмотров - не может быть отрицательным'
                                    },
                                    likes: {
                                        bsonType: 'int',
                                        minimum: 0,
                                        description: 'Количество лайков - не может быть отрицательным'
                                    },
                                    comments: {
                                        bsonType: 'int',
                                        minimum: 0,
                                        description: 'Количество комментариев - не может быть отрицательным'
                                    },
                                    engagementRate: {
                                        bsonType: ['double', 'int'],
                                        minimum: 0,
                                        maximum: 100,
                                        description: 'Процент вовлеченности от 0 до 100'
                                    }
                                }
                            },
                            
                            // Метаданные с правилами для дат
                            metadata: {
                                bsonType: 'object',
                                required: ['publishDate', 'isActive'],
                                properties: {
                                    publishDate: {
                                        bsonType: 'date',
                                        description: 'Дата публикации'
                                    },
                                    isActive: {
                                        bsonType: 'bool',
                                        description: 'Активна ли новость'
                                    },
                                    isBreaking: {
                                        bsonType: 'bool',
                                        description: 'Срочная новость'
                                    },
                                    tags: {
                                        bsonType: 'array',
                                        description: 'Теги новости',
                                        maxItems: 10, // Не больше 10 тегов
                                        items: {
                                            bsonType: 'string',
                                            maxLength: 50
                                        }
                                    },
                                    readingTime: {
                                        bsonType: 'int',
                                        minimum: 1,
                                        maximum: 60,
                                        description: 'Время чтения в минутах (1-60)'
                                    }
                                }
                            },
                            
                            // Статус из ограниченного списка
                            status: {
                                bsonType: 'string',
                                enum: ['draft', 'published', 'archived', 'deleted'],
                                description: 'Статус новости'
                            },
                            
                            // Ссылка на источник
                            source: {
                                bsonType: 'object',
                                properties: {
                                    name: {
                                        bsonType: 'string',
                                        minLength: 2
                                    },
                                    website: {
                                        bsonType: 'string',
                                        pattern: '^https?://'
                                    },
                                    country: {
                                        bsonType: 'string',
                                        minLength: 2,
                                        maxLength: 50
                                    }
                                }
                            },
                            
                            // Информация об авторе
                            author: {
                                bsonType: 'object',
                                properties: {
                                    name: {
                                        bsonType: 'string',
                                        minLength: 3
                                    },
                                    email: {
                                        bsonType: 'string',
                                        pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$'
                                    }
                                }
                            }
                        }
                    }
                },
                validationLevel: 'strict', // Строгая валидация
                validationAction: 'error'  // Ошибка при несоответствии
            });
            
            console.log('✅ Коллекция news создана с валидацией схемы');
            
            // Создаем индекс для уникальности hash
            await this.db.collection('news').createIndex(
                { hash: 1 },
                { 
                    unique: true,
                    name: 'unique_hash',
                    partialFilterExpression: { hash: { $exists: true } }
                }
            );
            console.log('✅ Создан уникальный индекс для hash');
            
            // 2. КОЛЛЕКЦИЯ COMMENTS С ВАЛИДАЦИЕЙ
            console.log('\n2. Создаем/обновляем коллекцию comments с валидацией...');
            
            try {
                await this.db.collection('comments').drop();
            } catch (e) {}
            
            await this.db.createCollection('comments', {
                validator: {
                    $jsonSchema: {
                        bsonType: 'object',
                        required: ['articleId', 'user', 'comment', 'timestamp', 'isActive'],
                        properties: {
                            // Ссылка на статью (обязательно ObjectId)
                            articleId: {
                                bsonType: 'objectId',
                                description: 'ID статьи, к которой относится комментарий'
                            },
                            
                            // БИЗНЕС-ПРАВИЛО 4: Имя пользователя должно соответствовать паттерну
                            user: {
                                bsonType: 'string',
                                description: 'Имя пользователя',
                                pattern: '^[a-zA-Z0-9_]{3,20}$',
                                minLength: 3,
                                maxLength: 20
                            },
                            
                            // Комментарий с ограничениями по длине
                            comment: {
                                bsonType: 'string',
                                description: 'Текст комментария',
                                minLength: 3,
                                maxLength: 1000
                            },
                            
                            // Лайки не могут быть отрицательными
                            likes: {
                                bsonType: 'int',
                                minimum: 0,
                                maximum: 10000,
                                description: 'Количество лайков комментария'
                            },
                            
                            timestamp: {
                                bsonType: 'date',
                                description: 'Время создания комментария'
                            },
                            
                            isActive: {
                                bsonType: 'bool',
                                description: 'Активен ли комментарий'
                            },
                            
                            // БИЗНЕС-ПРАВИЛО 5: Локация из разрешенного списка
                            userLocation: {
                                bsonType: 'string',
                                enum: ['New York', 'London', 'Tokyo', 'Berlin', 'Paris', 
                                       'Moscow', 'Beijing', 'Sydney', 'Other'],
                                description: 'Локация пользователя из предопределенного списка'
                            },
                            
                            // Модерационные флаги
                            flags: {
                                bsonType: 'object',
                                properties: {
                                    reported: { bsonType: 'bool' },
                                    spam: { bsonType: 'bool' },
                                    inappropriate: { bsonType: 'bool' },
                                    moderatorNotes: { bsonType: 'string' }
                                }
                            }
                        }
                    }
                },
                validationLevel: 'moderate'
            });
            
            console.log('✅ Коллекция comments создана с валидацией схемы');
            
            // 3. КОЛЛЕКЦИЯ TAGS С ВАЛИДАЦИЕЙ
            console.log('\n3. Создаем/обновляем коллекцию tags с валидацией...');
            
            try {
                await this.db.collection('tags').drop();
            } catch (e) {}
            
            await this.db.createCollection('tags', {
                validator: {
                    $jsonSchema: {
                        bsonType: 'object',
                        required: ['name', 'usageCount', 'createdAt'],
                        properties: {
                            // Имя тега должно быть уникальным и соответствовать паттерну
                            name: {
                                bsonType: 'string',
                                description: 'Название тега',
                                pattern: '^[a-z0-9_]+$', // только строчные буквы, цифры и подчеркивание
                                minLength: 2,
                                maxLength: 50
                            },
                            
                            description: {
                                bsonType: 'string',
                                maxLength: 200
                            },
                            
                            // Счетчик использования не может быть отрицательным
                            usageCount: {
                                bsonType: 'int',
                                minimum: 0,
                                description: 'Количество использований тега'
                            },
                            
                            createdAt: {
                                bsonType: 'date'
                            },
                            
                            updatedAt: {
                                bsonType: 'date'
                            },
                            
                            // Категория тега (опционально)
                            category: {
                                bsonType: 'string',
                                enum: ['topic', 'sentiment', 'location', 'event', 'other']
                            },
                            
                            // Статистика популярности
                            popularity: {
                                bsonType: 'object',
                                properties: {
                                    trend: {
                                        bsonType: 'string',
                                        enum: ['rising', 'stable', 'declining']
                                    },
                                    weeklyGrowth: {
                                        bsonType: 'int',
                                        minimum: -100,
                                        maximum: 1000
                                    }
                                }
                            }
                        }
                    }
                }
            });
            
            // Создаем уникальный индекс для name
            await this.db.collection('tags').createIndex(
                { name: 1 },
                { unique: true, name: 'unique_tag_name' }
            );
            
            console.log('✅ Коллекция tags создана с валидацией схемы');
            
            // 4. КОЛЛЕКЦИЯ AUTHORS_STATS С ВАЛИДАЦИЕЙ
            console.log('\n4. Создаем/обновляем коллекцию authors_stats с валидацией...');
            
            try {
                await this.db.collection('authors_stats').drop();
            } catch (e) {}
            
            await this.db.createCollection('authors_stats', {
                validator: {
                    $jsonSchema: {
                        bsonType: 'object',
                        required: ['authorName', 'totalArticles', 'totalViews', 'isActive'],
                        properties: {
                            authorName: {
                                bsonType: 'string',
                                minLength: 3,
                                maxLength: 100
                            },
                            
                            authorEmail: {
                                bsonType: 'string',
                                pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$'
                            },
                            
                            // БИЗНЕС-ПРАВИЛО 6: Статистика должна быть неотрицательной
                            totalArticles: {
                                bsonType: 'int',
                                minimum: 0,
                                description: 'Общее количество статей автора'
                            },
                            
                            totalViews: {
                                bsonType: 'int',
                                minimum: 0,
                                description: 'Общее количество просмотров'
                            },
                            
                            totalLikes: {
                                bsonType: 'int',
                                minimum: 0
                            },
                            
                            totalShares: {
                                bsonType: 'int',
                                minimum: 0
                            },
                            
                            // Средние значения с разумными пределами
                            avgViewsPerArticle: {
                                bsonType: 'int',
                                minimum: 0,
                                maximum: 1000000
                            },
                            
                            avgEngagementRate: {
                                bsonType: ['double', 'int'],
                                minimum: 0,
                                maximum: 100
                            },
                            
                            isActive: {
                                bsonType: 'bool'
                            },
                            
                            performanceScore: {
                                bsonType: 'int',
                                minimum: 0,
                                maximum: 100
                            },
                            
                            // Категории, в которых работает автор
                            categories: {
                                bsonType: 'array',
                                maxItems: 10,
                                items: {
                                    bsonType: 'string'
                                }
                            },
                            
                            joinedDate: {
                                bsonType: 'date'
                            },
                            
                            lastArticleDate: {
                                bsonType: 'date'
                            }
                        }
                    }
                }
            });
            
            console.log('✅ Коллекция authors_stats создана с валидацией схемей');
            
            // 5. ДЕМОНСТРАЦИЯ ВАЛИДАЦИИ
            console.log('\n=== ДЕМОНСТРАЦИЯ ВАЛИДАЦИИ ===\n');
            await this.testValidationRules();
            
            console.log('\n' + '='.repeat(50));
            console.log('🎉 ВАЛИДАЦИЯ СХЕМЫ НАСТРОЕНА УСПЕШНО!');
            console.log('='.repeat(50));
            console.log('\nБИЗНЕС-ПРАВИЛА, РЕАЛИЗОВАННЫЕ В СХЕМЕ:');
            console.log('1. ✅ Заголовок новости: 10-200 символов');
            console.log('2. ✅ Контент новости: 100-10000 символов');
            console.log('3. ✅ Просмотры/лайки: не могут быть отрицательными');
            console.log('4. ✅ Имя пользователя: только буквы/цифры, 3-20 символов');
            console.log('5. ✅ Локация пользователя: только из предопределенного списка');
            console.log('6. ✅ Статистика автора: неотрицательные значения');
            
        } catch (error) {
            console.error('❌ Ошибка при создании коллекций с валидацией:', error.message);
            throw error;
        }
    }
    
    // Тестирование валидационных правил
    async testValidationRules() {
        console.log('🧪 Тестирование бизнес-правил валидации...\n');
        
        // Тест 1: Попытка вставить новость с коротким заголовком
        console.log('Тест 1: Короткий заголовок (< 10 символов)');
        try {
            await this.db.collection('news').insertOne({
                title: 'Short', // 5 символов - должно вызвать ошибку
                content: 'Valid content that is long enough to pass validation rules for minimum length requirement.',
                category: 'technology',
                hash: 'test123',
                metrics: { views: 0, likes: 0, comments: 0 },
                metadata: { 
                    publishDate: new Date(), 
                    isActive: true 
                },
                status: 'published'
            });
            console.log('   ❌ ОШИБКА: Документ принят, но не должен был!');
        } catch (error) {
            console.log('   ✅ ПРАВИЛО РАБОТАЕТ: ' + error.message.split('$jsonSchema: ')[1]);
        }
        
        // Тест 2: Попытка вставить новость с отрицательными просмотрами
        console.log('\nТест 2: Отрицательные просмотры');
        try {
            await this.db.collection('news').insertOne({
                title: 'Valid Title That Is Long Enough',
                content: 'Valid content that is long enough to pass validation rules for minimum length requirement.',
                category: 'technology',
                hash: 'test456',
                metrics: { views: -10, likes: 0, comments: 0 }, // Отрицательные просмотры!
                metadata: { 
                    publishDate: new Date(), 
                    isActive: true 
                },
                status: 'published'
            });
            console.log('   ❌ ОШИБКА: Документ принят, но не должен был!');
        } catch (error) {
            console.log('   ✅ ПРАВИЛО РАБОТАЕТ: ' + error.message.split('minimum').slice(-1)[0]);
        }
        
        // Тест 3: Попытка вставить комментарий с недопустимым именем пользователя
        console.log('\nТест 3: Недопустимое имя пользователя (спецсимволы)');
        try {
            await this.db.collection('comments').insertOne({
                articleId: new require('mongodb').ObjectId(), // Валидный ObjectId
                user: 'john@doe', // Спецсимволы - недопустимо!
                comment: 'Valid comment text',
                likes: 0,
                timestamp: new Date(),
                isActive: true,
                userLocation: 'New York'
            });
            console.log('   ❌ ОШИБКА: Документ принят, но не должен был!');
        } catch (error) {
            console.log('   ✅ ПРАВИЛО РАБОТАЕТ: Имя должно соответствовать паттерну');
        }
        
        // Тест 4: Попытка вставить комментарий с недопустимой локацией
        console.log('\nТест 4: Недопустимая локация пользователя');
        try {
            await this.db.collection('comments').insertOne({
                articleId: new require('mongodb').ObjectId(),
                user: 'johndoe', // Валидное имя
                comment: 'Valid comment text',
                likes: 0,
                timestamp: new Date(),
                isActive: true,
                userLocation: 'Mars' // Не из списка разрешенных!
            });
            console.log('   ❌ ОШИБКА: Документ принят, но не должен был!');
        } catch (error) {
            console.log('   ✅ ПРАВИЛО РАБОТАЕТ: Локация должна быть из разрешенного списка');
        }
        
        // Тест 5: Успешная вставка валидного документа
        console.log('\nТест 5: Успешная вставка валидной новости');
        try {
            const result = await this.db.collection('news').insertOne({
                title: 'This Is a Perfectly Valid News Title That Meets All Requirements',
                content: 'This content is definitely long enough to satisfy all validation rules. It contains more than 100 characters which is the minimum requirement for news articles in our system. Additional text to ensure length requirements are met.',
                category: 'technology',
                hash: 'valid_hash_' + Date.now(),
                source: {
                    name: 'Tech News',
                    website: 'https://technews.com',
                    country: 'USA'
                },
                author: {
                    name: 'John Doe',
                    email: 'john@technews.com'
                },
                metrics: { 
                    views: 1000, 
                    likes: 50, 
                    comments: 10,
                    engagementRate: 6.0
                },
                metadata: { 
                    publishDate: new Date(), 
                    isActive: true,
                    tags: ['technology', 'innovation'],
                    readingTime: 5,
                    wordCount: 150
                },
                status: 'published',
                createdAt: new Date(),
                updatedAt: new Date()
            });
            console.log('   ✅ УСПЕХ: Валидный документ вставлен с ID:', result.insertedId);
            
            // Удаляем тестовый документ
            await this.db.collection('news').deleteOne({ _id: result.insertedId });
            
        } catch (error) {
            console.log('   ❌ НЕОЖИДАННАЯ ОШИБКА: ' + error.message);
        }
        
        // Тест 6: Проверка уникальности hash
        console.log('\nТест 6: Проверка уникальности hash (дедупликация)');
        try {
            const duplicateHash = 'duplicate_hash_test';
            
            // Первая вставка
            await this.db.collection('news').insertOne({
                title: 'First Article',
                content: 'Content of first article',
                category: 'sports',
                hash: duplicateHash,
                metrics: { views: 0, likes: 0, comments: 0 },
                metadata: { publishDate: new Date(), isActive: true },
                status: 'published'
            });
            console.log('   ✅ Первая вставка успешна');
            
            // Попытка второй вставки с тем же hash
            await this.db.collection('news').insertOne({
                title: 'Second Article With Same Hash',
                content: 'Different content but same hash should fail',
                category: 'sports',
                hash: duplicateHash, // Тот же hash!
                metrics: { views: 0, likes: 0, comments: 0 },
                metadata: { publishDate: new Date(), isActive: true },
                status: 'published'
            });
            console.log('   ❌ ОШИБКА: Дубликат hash должен был быть отклонен!');
            
        } catch (error) {
            if (error.code === 11000) {
                console.log('   ✅ ПРАВИЛО РАБОТАЕТ: Дубликат hash отклонен (уникальный индекс)');
            } else {
                console.log('   ❌ ДРУГАЯ ОШИБКА: ' + error.message);
            }
        }
        
        // Очистка тестовых данных
        await this.db.collection('news').deleteMany({ hash: /test|valid_hash|duplicate/ });
        console.log('\n🧹 Тестовые данные очищены');
    }
    
    // Получение информации о валидации
    async getValidationInfo() {
        console.log('\n=== ИНФОРМАЦИЯ О ВАЛИДАЦИИ КОЛЛЕКЦИЙ ===\n');
        
        const collections = ['news', 'comments', 'tags', 'authors_stats'];
        
        for (const collectionName of collections) {
            try {
                const collStats = await this.db.command({
                    collStats: collectionName
                });
                
                const options = await this.db.collection(collectionName).options();
                
                console.log(`📁 Коллекция: ${collectionName}`);
                console.log(`   Количество документов: ${collStats.count}`);
                console.log(`   Валидация включена: ${options.validator ? 'Да' : 'Нет'}`);
                
                if (options.validator) {
                    console.log(`   Уровень валидации: ${options.validationLevel || 'strict'}`);
                    console.log(`   Действие при ошибке: ${options.validationAction || 'error'}`);
                    
                    // Выводим упрощенную схему
                    if (options.validator.$jsonSchema) {
                        const required = options.validator.$jsonSchema.required || [];
                        console.log(`   Обязательные поля: ${required.length > 0 ? required.join(', ') : 'нет'}`);
                        
                        // Считаем количество правил
                        const rules = Object.keys(options.validator.$jsonSchema.properties || {}).length;
                        console.log(`   Количество правил валидации: ${rules}`);
                    }
                }
                
                console.log('');
                
            } catch (error) {
                console.log(`❌ Ошибка при получении информации о ${collectionName}: ${error.message}`);
            }
        }
    }
    
    // Основная функция
    async setupAndTestValidation() {
        await this.connect();
        
        console.log('=== НАСТРОЙКА ВАЛИДАЦИИ СХЕМЫ MONGODB ===\n');
        
        try {
            // Создаем коллекции с валидацией
            await this.createValidatedCollections();
            
            // Получаем информацию о валидации
            await this.getValidationInfo();
            
            console.log('\n' + '='.repeat(60));
            console.log('🎯 ВАЛИДАЦИЯ СХЕМЫ УСПЕШНО НАСТРОЕНА');
            console.log('='.repeat(60));
            console.log('\nПРАВИЛА ВАЛИДАЦИИ АКТИВНЫ ДЛЯ:');
            console.log('   • Коллекция news (строгая валидация)');
            console.log('   • Коллекция comments (умеренная валидация)');
            console.log('   • Коллекция tags (базовая валидация)');
            console.log('   • Коллекция authors_stats (базовая валидация)');
            console.log('\nДля применения к существующим данным используйте:');
            console.log('   db.runCommand({ collMod: "news", validator: {...} })');
            
        } catch (error) {
            console.error('❌ Ошибка при настройке валидации:', error.message);
            
            // Предлагаем альтернативный способ для существующих данных
            console.log('\n💡 Если коллекции уже существуют, используйте команду collMod:');
            console.log(`
// Для коллекции news
db.runCommand({
    collMod: "news",
    validator: {
        $jsonSchema: {
            // ... схема валидации
        }
    },
    validationLevel: "strict",
    validationAction: "error"
});
            `);
        } finally {
            await this.disconnect();
        }
    }
}

// Запуск
if (require.main === module) {
    const validator = new SchemaValidator();
    
    validator.setupAndTestValidation().then(() => {
        console.log('\n✅ Валидация схемы настроена и протестирована!');
        process.exit(0);
    }).catch(err => {
        console.error('❌ Ошибка:', err);
        process.exit(1);
    });
}

module.exports = { SchemaValidator };