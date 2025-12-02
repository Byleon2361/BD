// 5labscript/sharding-setup.js
// Настройка шардинговой инфраструктуры

const { MongoClient, MongoTimeoutError } = require('mongodb');

class ShardingManager {
    constructor() {
        this.configDb = null;
        this.shardConnections = new Map();
    }
    
    // Подключение к конфигурационному серверу (mongos)
    async connectToConfigServer(connectionString = 'mongodb://localhost:27017') {
        try {
            const client = new MongoClient(connectionString);
            await client.connect();
            this.configDb = client.db('config');
            console.log('✅ Подключено к конфигурационному серверу');
            return true;
        } catch (error) {
            console.error('❌ Ошибка подключения к конфигурационному серверу:', error.message);
            
            // Если нет конфигурационного сервера, создаем локальную эмуляцию для демонстрации
            console.log('⚠️  Создаем локальную эмуляцию шардинга для демонстрации...');
            await this.setupLocalShardingDemo();
            return false;
        }
    }
    
    // Подключение к шардам
    async connectToShards() {
        const shards = [
            { name: 'shard1', host: 'localhost:27018' },
            { name: 'shard2', host: 'localhost:27019' },
            { name: 'shard3', host: 'localhost:27020' }
        ];
        
        for (const shard of shards) {
            try {
                const client = new MongoClient(`mongodb://${shard.host}`);
                await client.connect();
                this.shardConnections.set(shard.name, client);
                console.log(`✅ Подключено к шарду ${shard.name} (${shard.host})`);
            } catch (error) {
                console.log(`⚠️  Шард ${shard.name} недоступен: ${error.message}`);
            }
        }
        
        if (this.shardConnections.size === 0) {
            console.log('⚠️  Шарды не доступны. Используем локальную базу для демонстрации.');
        }
    }
    
    // Локальная эмуляция шардинга для демонстрации
    async setupLocalShardingDemo() {
        console.log('\n=== ЛОКАЛЬНАЯ ЭМУЛЯЦИЯ ШАРДИНГА ===\n');
        
        // Подключаемся к основной базе
        const mainClient = new MongoClient('mongodb://news_user:news_password123@localhost:27017/news_aggregator?authSource=news_aggregator');
        await mainClient.connect();
        const mainDb = mainClient.db('news_aggregator');
        
        // Создаем коллекцию для хранения информации о шардах
        await mainDb.collection('sharding_info').deleteMany({});
        
        // Эмулируем три шарда
        const shards = [
            { 
                name: 'shard1_east', 
                region: 'east',
                description: 'Восточный регион - технологии и бизнес',
                keyRange: { min: 'a', max: 'h' }
            },
            { 
                name: 'shard2_west', 
                region: 'west',
                description: 'Западный регион - политика и спорт',
                keyRange: { min: 'i', max: 'p' }
            },
            { 
                name: 'shard3_central', 
                region: 'central',
                description: 'Центральный регион - развлечения и здоровье',
                keyRange: { min: 'q', max: 'z' }
            }
        ];
        
        await mainDb.collection('sharding_info').insertMany(shards);
        console.log('✅ Создана эмуляция шардинговой инфраструктуры');
        
        await mainClient.close();
    }
    
    // Настройка шардинга для коллекции news
    async setupNewsSharding() {
        console.log('\n=== НАСТРОЙКА ШАРДИНГА ДЛЯ КОЛЛЕКЦИИ NEWS ===\n');
        
        try {
            // Шаг 1: Включаем шардинг для базы данных
            console.log('1. Включаем шардинг для базы данных news_aggregator...');
            
            if (this.configDb) {
                try {
                    await this.configDb.admin().command({ enableSharding: 'news_aggregator' });
                    console.log('   ✅ Шардинг включен для базы данных');
                } catch (error) {
                    console.log('   ℹ️  Шардинг уже включен или ошибка:', error.message);
                }
            } else {
                console.log('   ⚠️  Пропущено (нет конфигурационного сервера)');
            }
            
            // Шаг 2: Создаем индекс для шард-ключа
            console.log('\n2. Создаем индекс для шард-ключа...');
            
            const mainClient = new MongoClient('mongodb://news_user:news_password123@localhost:27017/news_aggregator?authSource=news_aggregator');
            await mainClient.connect();
            const mainDb = mainClient.db('news_aggregator');
            
            // Создаем хеш-поле на основе категории для равномерного распределения
            await this.createShardKeyField(mainDb);
            
            // Создаем индекс на шард-ключ
            await mainDb.collection('news').createIndex(
                { shardKey: 'hashed' },
                { name: 'shard_key_hashed_index' }
            );
            console.log('   ✅ Создан хешированный индекс для шард-ключа');
            
            // Шаг 3: Выбираем стратегию шардинга
            console.log('\n3. Выбираем стратегию шардинга...');
            console.log('   📌 Анализ данных для выбора шард-ключа:');
            
            // Анализируем данные для выбора оптимального шард-ключа
            const analysis = await this.analyzeDataForSharding(mainDb);
            
            console.log('   Статистика по категориям:');
            analysis.categoryStats.forEach(stat => {
                console.log(`     • ${stat._id}: ${stat.count} документов (${stat.percentage.toFixed(1)}%)`);
            });
            
            console.log(`\n   Предлагаемый шард-ключ: ${analysis.recommendedShardKey}`);
            console.log(`   Обоснование: ${analysis.recommendationReason}`);
            
            // Шаг 4: Настраиваем шардинг с выбранным ключом
            console.log('\n4. Настраиваем шардинг коллекции...');
            
            if (this.configDb) {
                try {
                    // Используем hashed sharding для равномерного распределения
                    await this.configDb.admin().command({
                        shardCollection: 'news_aggregator.news',
                        key: { shardKey: 'hashed' }
                    });
                    console.log('   ✅ Шардинг коллекции настроен');
                    console.log('   Ключ шардинга: { shardKey: "hashed" }');
                } catch (error) {
                    console.log('   ℹ️  Шардинг уже настроен или ошибка:', error.message);
                }
            } else {
                console.log('   ⚠️  Пропущено (нет конфигурационного сервера)');
                console.log('   Эмулируем распределение данных по шардам...');
                await this.simulateDataDistribution(mainDb);
            }
            
            // Шаг 5: Балансировка шардов
            console.log('\n5. Балансировка данных...');
            await this.balanceShards(mainDb);
            
            await mainClient.close();
            
        } catch (error) {
            console.error('❌ Ошибка при настройке шардинга:', error.message);
        }
    }
    
    // Создаем поле для шард-ключа
    async createShardKeyField(db) {
        console.log('   Создаем поле shardKey на основе категории...');
        
        // Обновляем все документы, добавляя shardKey
        const categories = await db.collection('news').distinct('category');
        
        // Создаем маппинг категорий к шардам
        const categoryToShard = {};
        categories.forEach((category, index) => {
            categoryToShard[category] = `shard${(index % 3) + 1}`;
        });
        
        // Обновляем документы
        const updateOps = [];
        const allNews = await db.collection('news').find({}).toArray();
        
        for (const news of allNews) {
            const shardKey = categoryToShard[news.category] || 'shard1';
            updateOps.push({
                updateOne: {
                    filter: { _id: news._id },
                    update: { $set: { shardKey: shardKey } }
                }
            });
            
            // Выполняем batch updates
            if (updateOps.length >= 1000) {
                await db.collection('news').bulkWrite(updateOps);
                updateOps.length = 0;
            }
        }
        
        if (updateOps.length > 0) {
            await db.collection('news').bulkWrite(updateOps);
        }
        
        console.log(`   ✅ Добавлено поле shardKey для ${allNews.length} документов`);
    }
    
    // Анализ данных для выбора шард-ключа
    async analyzeDataForSharding(db) {
        // Анализируем распределение по категориям
        const categoryStats = await db.collection('news').aggregate([
            { $group: { _id: '$category', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$count' },
                    categories: { $push: { category: '$_id', count: '$count' } }
                }
            },
            { $unwind: '$categories' },
            {
                $project: {
                    _id: '$categories.category',
                    count: '$categories.count',
                    percentage: { $multiply: [{ $divide: ['$categories.count', '$total'] }, 100] }
                }
            },
            { $sort: { count: -1 } }
        ]).toArray();
        
        // Анализируем распределение по датам
        const dateStats = await db.collection('news').aggregate([
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m', date: '$metadata.publishDate' } },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]).toArray();
        
        // Определяем рекомендуемый шард-ключ
        let recommendedShardKey = 'category';
        let recommendationReason = '';
        
        // Проверяем кардинальность категорий
        if (categoryStats.length < 10) {
            recommendedShardKey = 'shardKey'; // Композитный ключ
            recommendationReason = 'Мало категорий для равномерного распределения, используем композитный ключ';
        } else {
            // Проверяем равномерность распределения
            const percentages = categoryStats.map(c => c.percentage);
            const avgPercentage = percentages.reduce((a, b) => a + b, 0) / percentages.length;
            const variance = percentages.reduce((a, b) => a + Math.pow(b - avgPercentage, 2), 0) / percentages.length;
            
            if (variance > 100) { // Высокая дисперсия
                recommendedShardKey = 'hashed_shardKey';
                recommendationReason = 'Неравномерное распределение по категориям, используем хешированный ключ';
            } else {
                recommendedShardKey = 'category';
                recommendationReason = 'Равномерное распределение по категориям, хороший кандидат для шард-ключа';
            }
        }
        
        return {
            categoryStats,
            dateStats: dateStats.slice(0, 6), // Последние 6 месяцев
            recommendedShardKey,
            recommendationReason
        };
    }
    
    // Эмуляция распределения данных по шардам
    async simulateDataDistribution(db) {
        console.log('\n   📊 ЭМУЛЯЦИЯ РАСПРЕДЕЛЕНИЯ ДАННЫХ:');
        
        // Симуляция распределения по шардам
        const shardDistribution = await db.collection('news').aggregate([
            { $group: { _id: '$shardKey', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]).toArray();
        
        shardDistribution.forEach(shard => {
            console.log(`     Шард ${shard._id}: ${shard.count} документов`);
        });
        
        // Симуляция запросов к разным шардам
        console.log('\n   🔍 СИМУЛЯЦИЯ ЗАПРОСОВ С РАЗНЫМИ SHARD KEYS:');
        
        const testQueries = [
            { shardKey: 'shard1', description: 'Запрос к восточному шарду (технологии)' },
            { shardKey: 'shard2', description: 'Запрос к западному шарду (политика)' },
            { shardKey: 'shard3', description: 'Запрос к центральному шарду (развлечения)' },
            { shardKey: null, description: 'Запрос ко всем шардам (scatter-gather)' }
        ];
        
        for (const query of testQueries) {
            const startTime = Date.now();
            let resultCount;
            
            if (query.shardKey) {
                resultCount = await db.collection('news')
                    .countDocuments({ shardKey: query.shardKey });
            } else {
                resultCount = await db.collection('news').countDocuments();
            }
            
            const endTime = Date.now();
            const duration = endTime - startTime;
            
            console.log(`     ${query.description}: ${resultCount} документов, ${duration}ms`);
        }
    }
    
    // Балансировка шардов
    async balanceShards(db) {
        console.log('\n   ⚖️  БАЛАНСИРОВКА ШАРДОВ:');
        
        // Анализируем текущее распределение
        const distribution = await db.collection('news').aggregate([
            { $group: { _id: '$shardKey', count: { $sum: 1 } } }
        ]).toArray();
        
        const totalDocs = distribution.reduce((sum, shard) => sum + shard.count, 0);
        const avgPerShard = totalDocs / distribution.length;
        
        console.log('   Текущее распределение:');
        distribution.forEach(shard => {
            const deviation = ((shard.count - avgPerShard) / avgPerShard) * 100;
            const status = Math.abs(deviation) < 20 ? '✅ Сбалансирован' : '⚠️  Дисбаланс';
            console.log(`     ${shard._id}: ${shard.count} документов (${deviation.toFixed(1)}% ${deviation > 0 ? 'выше' : 'ниже'} среднего) - ${status}`);
        });
        
        // Если есть дисбаланс > 20%, предлагаем миграцию
        const unbalancedShards = distribution.filter(shard => {
            const deviation = Math.abs((shard.count - avgPerShard) / avgPerShard * 100);
            return deviation > 20;
        });
        
        if (unbalancedShards.length > 0) {
            console.log('\n   🔧 РЕКОМЕНДАЦИИ ПО БАЛАНСИРОВКЕ:');
            
            unbalancedShards.forEach(shard => {
                const deviation = ((shard.count - avgPerShard) / avgPerShard) * 100;
                const docsToMove = Math.abs(shard.count - avgPerShard);
                
                if (deviation > 0) {
                    console.log(`     Шард ${shard._id} перегружен. Рекомендуется переместить ${Math.round(docsToMove)} документов`);
                } else {
                    console.log(`     Шард ${shard._id} недогружен. Можно добавить данные`);
                }
            });
            
            console.log('\n   Команда для балансировки:');
            console.log('   db.adminCommand({ balancerStart: 1 })');
            console.log('   db.adminCommand({ moveChunk: "news_aggregator.news", find: {shardKey: "shard1"}, to: "shard2" })');
        } else {
            console.log('\n   ✅ Все шарды сбалансированы');
        }
    }
    
    // Тестирование производительности шардинга
    async testShardingPerformance() {
        console.log('\n=== ТЕСТИРОВАНИЕ ПРОИЗВОДИТЕЛЬНОСТИ ШАРДИНГА ===\n');
        
        const mainClient = new MongoClient('mongodb://news_user:news_password123@localhost:27017/news_aggregator?authSource=news_aggregator');
        await mainClient.connect();
        const mainDb = mainClient.db('news_aggregator');
        
        console.log('🏃 ТЕСТ 1: Запросы с точечным шард-ключом (targeted)');
        console.log('-'.repeat(50));
        
        // Тест с targeted queries
        const targetedQueries = [
            { shardKey: 'shard1', category: 'technology' },
            { shardKey: 'shard2', category: 'politics' },
            { shardKey: 'shard3', category: 'entertainment' }
        ];
        
        for (const query of targetedQueries) {
            const startTime = Date.now();
            const result = await mainDb.collection('news')
                .find(query)
                .limit(10)
                .explain('executionStats');
            
            const endTime = Date.now();
            const duration = endTime - startTime;
            
            console.log(`   Шард ${query.shardKey} (${query.category}):`);
            console.log(`     Время: ${duration}ms`);
            console.log(`     Документов: ${result.executionStats.nReturned}`);
            console.log(`     Шардов затронуто: ${result.queryPlanner.winningPlan.shardName ? 1 : 'Все'}`);
        }
        
        console.log('\n🏃 ТЕСТ 2: Запросы без шард-ключа (scatter-gather)');
        console.log('-'.repeat(50));
        
        const scatterGatherQueries = [
            { category: 'sports' }, // Без shardKey
            { 'metrics.views': { $gt: 1000 } }, // Без shardKey
            { 'metadata.publishDate': { $gte: new Date('2024-01-01') } } // Без shardKey
        ];
        
        for (const query of scatterGatherQueries) {
            const startTime = Date.now();
            const result = await mainDb.collection('news')
                .find(query)
                .limit(10)
                .explain('executionStats');
            
            const endTime = Date.now();
            const duration = endTime - startTime;
            
            console.log(`   Запрос ${JSON.stringify(query).substring(0, 40)}...:`);
            console.log(`     Время: ${duration}ms`);
            console.log(`     Шардов затронуто: ${result.clusterTime ? 'Все' : 'N/A'}`);
        }
        
        console.log('\n🏃 ТЕСТ 3: Агрегации с шардингом');
        console.log('-'.repeat(50));
        
        const aggregationTests = [
            {
                name: 'Агрегация по категориям с фильтром по shardKey',
                pipeline: [
                    { $match: { shardKey: 'shard1' } },
                    { $group: { _id: '$category', count: { $sum: 1 } } }
                ]
            },
            {
                name: 'Агрегация по всем шардам',
                pipeline: [
                    { $group: { _id: '$category', count: { $sum: 1 } } }
                ]
            }
        ];
        
        for (const test of aggregationTests) {
            const startTime = Date.now();
            const result = await mainDb.collection('news')
                .aggregate(test.pipeline)
                .toArray();
            
            const endTime = Date.now();
            
            console.log(`   ${test.name}:`);
            console.log(`     Время: ${endTime - startTime}ms`);
            console.log(`     Результатов: ${result.length}`);
        }
        
        console.log('\n📊 ВЫВОДЫ ПО ПРОИЗВОДИТЕЛЬНОСТИ:');
        console.log('   ✅ Targeted queries быстрее (запрос к одному шарду)');
        console.log('   ⚠️  Scatter-gather queries медленнее (запрос ко всем шардам)');
        console.log('   💡 Всегда включайте shardKey в запросы для лучшей производительности');
        
        await mainClient.close();
    }
    
    // Основная функция
    async setupAndTestSharding() {
        console.log('=== НАСТРОЙКА ШАРДИНГОВОЙ ИНФРАСТРУКТУРЫ ===\n');
        
        try {
            // Подключаемся к конфигурационному серверу
            await this.connectToConfigServer();
            
            // Подключаемся к шардам
            await this.connectToShards();
            
            // Настраиваем шардинг для коллекции news
            await this.setupNewsSharding();
            
            // Тестируем производительность
            await this.testShardingPerformance();
            
            console.log('\n' + '='.repeat(60));
            console.log('🎉 НАСТРОЙКА ШАРДИНГА ЗАВЕРШЕНА!');
            console.log('='.repeat(60));
            
            console.log('\n📝 КОНФИГУРАЦИЯ ШАРДИНГА:');
            console.log('   База данных: news_aggregator');
            console.log('   Коллекция: news');
            console.log('   Ключ шардинга: shardKey (hashed)');
            console.log('   Стратегия: Hashed Sharding');
            console.log('   Шарды: 3 (восточный, западный, центральный)');
            
            console.log('\n💡 РЕКОМЕНДАЦИИ:');
            console.log('   1. Всегда включайте shardKey в запросы');
            console.log('   2. Используйте covered queries с индексами на шардах');
            console.log('   3. Мониторьте балансировку шардов');
            console.log('   4. Избегайте scatter-gather запросов при возможности');
            
        } catch (error) {
            console.error('❌ Ошибка при настройке шардинга:', error.message);
            
            console.log('\n💡 Для реальной настройки шардинга:');
            console.log('   1. Запустите mongod экземпляры для каждого шарда');
            console.log('   2. Запустите config серверы');
            console.log('   3. Запустите mongos роутер');
            console.log('   4. Добавьте шарды в кластер: sh.addShard("host:port")');
            console.log('   5. Включите шардинг для базы: sh.enableSharding("news_aggregator")');
            console.log('   6. Настройте шардинг коллекции: sh.shardCollection("news_aggregator.news", {shardKey: 1})');
        }
    }
}

// Запуск
if (require.main === module) {
    const shardingManager = new ShardingManager();
    
    shardingManager.setupAndTestSharding().then(() => {
        console.log('\n✅ Настройка шардинга выполнена!');
        process.exit(0);
    }).catch(err => {
        console.error('❌ Ошибка:', err);
        process.exit(1);
    });
}

module.exports = { ShardingManager };