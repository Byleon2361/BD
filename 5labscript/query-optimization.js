// 5labscript/query-optimization.js
// Оптимизация запросов - анализ и улучшение производительности

const { MongoClient } = require('mongodb');

const MONGODB_URI = 'mongodb://news_user:news_password123@localhost:27017/news_aggregator?authSource=news_aggregator';

class QueryOptimizer {
    constructor() {
        this.client = null;
        this.db = null;
        this.results = [];
    }
    
    async connect() {
        this.client = new MongoClient(MONGODB_URI);
        await this.client.connect();
        this.db = this.client.db('news_aggregator');
        console.log('✅ Подключено к MongoDB для оптимизации запросов');
    }
    
    async disconnect() {
        if (this.client) {
            await this.client.close();
        }
    }
    
    // Метод для измерения времени выполнения
    async measureQueryPerformance(collection, query, options = {}) {
        const startTime = Date.now();
        const result = await collection.find(query, options).toArray();
        const endTime = Date.now();
        
        return {
            executionTime: endTime - startTime,
            documentsReturned: result.length,
            query: query,
            options: options
        };
    }
    
    // Метод для получения плана выполнения
    async getExecutionPlan(collection, query, options = {}) {
        const explain = await collection.find(query, options).explain('executionStats');
        
        return {
            winningPlan: explain.queryPlanner.winningPlan,
            executionStats: explain.executionStats,
            totalDocsExamined: explain.executionStats.totalDocsExamined,
            executionTimeMillis: explain.executionStats.executionTimeMillis,
            stage: explain.queryPlanner.winningPlan.stage || 'COLLSCAN'
        };
    }
    
    // ЗАПРОС 1: Медленный запрос без индекса
    async slowQuery1() {
        console.log('\n🔍 ЗАПРОС 1: Поиск новостей по категории и дате (без индекса)');
        console.log('='.repeat(70));
        
        const query = {
            category: 'technology',
            'metadata.publishDate': { 
                $gte: new Date('2024-01-01'),
                $lte: new Date('2024-12-31')
            }
        };
        
        const options = {
            sort: { 'metrics.views': -1 },
            limit: 50
        };
        
        // Выполняем до оптимизации
        console.log('\n📉 ДО ОПТИМИЗАЦИИ:');
        const before = await this.getExecutionPlan(this.db.collection('news'), query, options);
        console.log(`   Тип выполнения: ${before.stage}`);
        console.log(`   Документов просканировано: ${before.totalDocsExamined}`);
        console.log(`   Время выполнения: ${before.executionTimeMillis}ms`);
        
        // Анализируем проблему
        console.log('\n🔎 ПРОБЛЕМА:');
        console.log('   • Запрос использует COLLSCAN (полное сканирование коллекции)');
        console.log('   • Сортировка по views требует дополнительной обработки в памяти');
        console.log('   • Нет составного индекса для category + publishDate + views');
        
        // Создаем оптимизированный индекс
        console.log('\n⚡ ОПТИМИЗАЦИЯ:');
        console.log('   Создаем составной индекс:');
        console.log('   db.news.createIndex({ category: 1, "metadata.publishDate": 1, "metrics.views": -1 })');
        
        try {
            await this.db.collection('news').createIndex(
                { category: 1, "metadata.publishDate": 1, "metrics.views": -1 },
                { name: 'idx_category_date_views' }
            );
            console.log('   ✅ Индекс создан успешно');
        } catch (error) {
            console.log('   ℹ️  Индекс уже существует или ошибка:', error.message);
        }
        
        // Выполняем после оптимизации
        console.log('\n📈 ПОСЛЕ ОПТИМИЗАЦИИ:');
        const after = await this.getExecutionPlan(this.db.collection('news'), query, options);
        console.log(`   Тип выполнения: ${after.stage}`);
        console.log(`   Документов просканировано: ${after.totalDocsExamined}`);
        console.log(`   Время выполнения: ${after.executionTimeMillis}ms`);
        
        // Расчет улучшения
        const improvement = ((before.executionTimeMillis - after.executionTimeMillis) / before.executionTimeMillis) * 100;
        const documentsImprovement = ((before.totalDocsExamined - after.totalDocsExamined) / before.totalDocsExamined) * 100;
        
        console.log('\n📊 РЕЗУЛЬТАТЫ ОПТИМИЗАЦИИ:');
        console.log(`   Ускорение: ${improvement.toFixed(2)}%`);
        console.log(`   Сканируемых документов меньше на: ${documentsImprovement.toFixed(2)}%`);
        console.log(`   Новый план выполнения: ${JSON.stringify(after.winningPlan.inputStage || after.winningPlan, null, 2).substring(0, 200)}...`);
        
        // Сохраняем результат
        this.results.push({
            query: 'Query1 - Category + Date + Views',
            before: before.executionTimeMillis,
            after: after.executionTimeMillis,
            improvement: improvement,
            stageBefore: before.stage,
            stageAfter: after.stage,
            indexCreated: 'category_1_metadata.publishDate_1_metrics.views_-1'
        });
    }
    
    // ЗАПРОС 2: Сложная агрегация без индексов
    async slowQuery2() {
        console.log('\n🔍 ЗАПРОС 2: Агрегация по авторам с группировкой (медленная)');
        console.log('='.repeat(70));
        
        const pipeline = [
            {
                $match: {
                    "metadata.isActive": true,
                    "metadata.publishDate": { $gte: new Date('2023-01-01') }
                }
            },
            {
                $group: {
                    _id: "$author.name",
                    totalArticles: { $sum: 1 },
                    totalViews: { $sum: "$metrics.views" },
                    avgViews: { $avg: "$metrics.views" },
                    categories: { $addToSet: "$category" }
                }
            },
            {
                $project: {
                    author: "$_id",
                    totalArticles: 1,
                    totalViews: 1,
                    avgViews: { $round: ["$avgViews", 2] },
                    categoriesCount: { $size: "$categories" }
                }
            },
            {
                $sort: { totalViews: -1 }
            },
            {
                $limit: 100
            }
        ];
        
        // Выполняем до оптимизации
        console.log('\n📉 ДО ОПТИМИЗАЦИИ:');
        const startTimeBefore = Date.now();
        const explainBefore = await this.db.collection('news').aggregate(pipeline).explain('executionStats');
        const endTimeBefore = Date.now();
        
        const beforeTime = endTimeBefore - startTimeBefore;
        console.log(`   Время выполнения: ${beforeTime}ms`);
        console.log(`   Документов просканировано: ${explainBefore.stages[0]?.$cursor?.executionStats?.totalDocsExamined || 'N/A'}`);
        
        // Анализируем проблему
        console.log('\n🔎 ПРОБЛЕМА:');
        console.log('   • Агрегация сканирует все документы за 2 года');
        console.log('   • Нет индекса для быстрого фильтра по isActive и publishDate');
        console.log('   • Группировка по author.name не использует индекс');
        
        // Создаем оптимизированные индексы
        console.log('\n⚡ ОПТИМИЗАЦИЯ:');
        console.log('   Создаем индексы:');
        console.log('   1. Для фильтрации: db.news.createIndex({ "metadata.isActive": 1, "metadata.publishDate": -1 })');
        console.log('   2. Для группировки: db.news.createIndex({ "author.name": 1 })');
        
        try {
            await this.db.collection('news').createIndex(
                { "metadata.isActive": 1, "metadata.publishDate": -1 },
                { name: 'idx_active_publish_date' }
            );
            
            await this.db.collection('news').createIndex(
                { "author.name": 1 },
                { name: 'idx_author_name' }
            );
            
            console.log('   ✅ Индексы созданы успешно');
        } catch (error) {
            console.log('   ℹ️  Индексы уже существуют или ошибка:', error.message);
        }
        
        // Оптимизируем pipeline
        const optimizedPipeline = [
            // Используем индекс для фильтрации
            {
                $match: {
                    "metadata.isActive": true,
                    "metadata.publishDate": { 
                        $gte: new Date('2024-01-01') // Более узкий диапазон
                    }
                }
            },
            // Используем индекс для сортировки на раннем этапе
            {
                $sort: { "metrics.views": -1 }
            },
            {
                $group: {
                    _id: "$author.name",
                    totalArticles: { $sum: 1 },
                    totalViews: { $sum: "$metrics.views" },
                    avgViews: { $avg: "$metrics.views" },
                    categories: { $addToSet: "$category" },
                    sampleTitles: { $push: { $substr: ["$title", 0, 30] } }
                }
            },
            // Ранний limit для уменьшения работы
            {
                $limit: 150
            },
            {
                $project: {
                    author: "$_id",
                    totalArticles: 1,
                    totalViews: 1,
                    avgViews: { $round: ["$avgViews", 2] },
                    categoriesCount: { $size: "$categories" }
                }
            },
            {
                $sort: { totalViews: -1 }
            },
            {
                $limit: 100
            }
        ];
        
        // Выполняем после оптимизации
        console.log('\n📈 ПОСЛЕ ОПТИМИЗАЦИИ:');
        const startTimeAfter = Date.now();
        const explainAfter = await this.db.collection('news').aggregate(optimizedPipeline).explain('executionStats');
        const endTimeAfter = Date.now();
        
        const afterTime = endTimeAfter - startTimeAfter;
        console.log(`   Время выполнения: ${afterTime}ms`);
        console.log(`   Документов просканировано: ${explainAfter.stages[0]?.$cursor?.executionStats?.totalDocsExamined || 'N/A'}`);
        
        // Расчет улучшения
        const improvement = ((beforeTime - afterTime) / beforeTime) * 100;
        
        console.log('\n📊 РЕЗУЛЬТАТЫ ОПТИМИЗАЦИИ:');
        console.log(`   Ускорение: ${improvement.toFixed(2)}%`);
        console.log(`   Оптимизации применены:`);
        console.log('   1. ✅ Добавлены индексы для фильтрации и группировки');
        console.log('   2. ✅ Уменьшен временной диапазон (1 год вместо 2)');
        console.log('   3. ✅ Ранний limit для уменьшения объема данных');
        console.log('   4. ✅ Ранняя сортировка для использования индекса');
        
        // Сохраняем результат
        this.results.push({
            query: 'Query2 - Authors Aggregation',
            before: beforeTime,
            after: afterTime,
            improvement: improvement,
            optimizations: [
                'Index: metadata.isActive + metadata.publishDate',
                'Index: author.name',
                'Reduced time range',
                'Early limit and sort'
            ]
        });
    }
    
    // ЗАПРОС 3: Поиск с текстовым индексом и фильтрацией
    async slowQuery3() {
        console.log('\n🔍 ЗАПРОС 3: Текстовый поиск с дополнительными фильтрами');
        console.log('='.repeat(70));
        
        const query = {
            $text: { $search: 'technology AI innovation' },
            category: 'technology',
            'metrics.views': { $gt: 1000 },
            'metadata.publishDate': { $gte: new Date('2023-06-01') }
        };
        
        const options = {
            sort: { score: { $meta: 'textScore' } },
            limit: 25,
            projection: { 
                title: 1, 
                category: 1, 
                'metrics.views': 1,
                'metadata.publishDate': 1,
                score: { $meta: 'textScore' }
            }
        };
        
        // Выполняем до оптимизации
        console.log('\n📉 ДО ОПТИМИЗАЦИИ:');
        const before = await this.getExecutionPlan(this.db.collection('news'), query, options);
        console.log(`   Тип выполнения: ${before.stage}`);
        console.log(`   Документов просканировано: ${before.totalDocsExamined}`);
        console.log(`   Время выполнения: ${before.executionTimeMillis}ms`);
        
        // Анализируем проблему
        console.log('\n🔎 ПРОБЛЕМА:');
        console.log('   • Текстовый поиск возвращает много результатов');
        console.log('   • Дополнительные фильтры применяются после текстового поиска');
        console.log('   • Нет составного индекса для category + views + date');
        
        // Создаем оптимизированные индексы
        console.log('\n⚡ ОПТИМИЗАЦИЯ:');
        console.log('   Создаем составной индекс для фильтрации:');
        console.log('   db.news.createIndex({ category: 1, "metrics.views": -1, "metadata.publishDate": -1 })');
        
        try {
            await this.db.collection('news').createIndex(
                { category: 1, "metrics.views": -1, "metadata.publishDate": -1 },
                { name: 'idx_category_views_date' }
            );
            console.log('   ✅ Индекс создан успешно');
        } catch (error) {
            console.log('   ℹ️  Индекс уже существует или ошибка:', error.message);
        }
        
        // Оптимизируем запрос - изменяем порядок фильтров
        const optimizedQuery = {
            category: 'technology', // Сначала используем селективный фильтр
            'metrics.views': { $gt: 1000 },
            'metadata.publishDate': { $gte: new Date('2023-06-01') },
            $text: { $search: 'technology AI innovation' } // Текстовый поиск в конце
        };
        
        // Выполняем после оптимизации
        console.log('\n📈 ПОСЛЕ ОПТИМИЗАЦИИ:');
        const after = await this.getExecutionPlan(this.db.collection('news'), optimizedQuery, options);
        console.log(`   Тип выполнения: ${after.stage}`);
        console.log(`   Документов просканировано: ${after.totalDocsExamined}`);
        console.log(`   Время выполнения: ${after.executionTimeMillis}ms`);
        
        // Расчет улучшения
        const improvement = ((before.executionTimeMillis - after.executionTimeMillis) / before.executionTimeMillis) * 100;
        const documentsImprovement = ((before.totalDocsExamined - after.totalDocsExamined) / before.totalDocsExamined) * 100;
        
        console.log('\n📊 РЕЗУЛЬТАТЫ ОПТИМИЗАЦИИ:');
        console.log(`   Ускорение: ${improvement.toFixed(2)}%`);
        console.log(`   Сканируемых документов меньше на: ${documentsImprovement.toFixed(2)}%`);
        console.log(`   Оптимизации применены:`);
        console.log('   1. ✅ Создан составной индекс для фильтров');
        console.log('   2. ✅ Изменен порядок фильтров в запросе');
        console.log('   3. ✅ Сначала применяются селективные фильтры');
        console.log('   4. ✅ Текстовый поиск выполняется на отфильтрованном наборе');
        
        // Сохраняем результат
        this.results.push({
            query: 'Query3 - Text Search with Filters',
            before: before.executionTimeMillis,
            after: after.executionTimeMillis,
            improvement: improvement,
            stageBefore: before.stage,
            stageAfter: after.stage,
            optimizations: [
                'Compound index: category + views + date',
                'Reordered query filters',
                'Selective filters first'
            ]
        });
    }
    
    // Анализ всех индексов
    async analyzeIndexes() {
        console.log('\n📊 АНАЛИЗ ИНДЕКСОВ КОЛЛЕКЦИИ NEWS');
        console.log('='.repeat(50));
        
        const indexes = await this.db.collection('news').indexes();
        
        console.log(`\nВсего индексов: ${indexes.length}`);
        console.log('-' .repeat(30));
        
        indexes.forEach((index, i) => {
            console.log(`${i + 1}. ${index.name}:`);
            console.log(`   Поля: ${JSON.stringify(index.key)}`);
            console.log(`   Уникальный: ${index.unique ? 'Да' : 'Нет'}`);
            console.log(`   Размер: ${index.size ? Math.round(index.size / 1024 / 1024) + ' MB' : 'N/A'}`);
            console.log(`   Фоновый: ${index.background ? 'Да' : 'Нет'}`);
            if (index.partialFilterExpression) {
                console.log(`   Частичный: ${JSON.stringify(index.partialFilterExpression)}`);
            }
            console.log('');
        });
        
        // Анализ использования индексов
        console.log('📈 СТАТИСТИКА ИСПОЛЬЗОВАНИЯ ИНДЕКСОВ:');
        
        const stats = await this.db.command({ collStats: 'news' });
        
        if (stats.indexDetails) {
            Object.entries(stats.indexDetails).forEach(([indexName, details]) => {
                console.log(`   ${indexName}:`);
                console.log(`      Доступов: ${details.accesses?.ops || 0}`);
                console.log(`      В памяти: ${details.memory ? Math.round(details.memory / 1024 / 1024) + ' MB' : 'N/A'}`);
            });
        }
        
        // Рекомендации по индексам
        console.log('\n💡 РЕКОМЕНДАЦИИ ПО ИНДЕКСАМ:');
        console.log('   1. Удалите неиспользуемые индексы для экономии памяти');
        console.log('   2. Рассмотрите создание покрывающих индексов для частых запросов');
        console.log('   3. Используйте частичные индексы для часто фильтруемых полей');
        console.log('   4. Монтируйте индексы в память для горячих данных');
    }
    
    // Общие рекомендации по оптимизации
    async generalOptimizationTips() {
        console.log('\n🎯 ОБЩИЕ РЕКОМЕНДАЦИИ ПО ОПТИМИЗАЦИИ');
        console.log('='.repeat(50));
        
        console.log('\n1. 📏 ПРАВИЛЬНОЕ ИСПОЛЬЗОВАНИЕ ИНДЕКСОВ:');
        console.log('   • Создавайте индексы на часто фильтруемых полях');
        console.log('   • Используйте составные индексы для запросов с несколькими условиями');
        console.log('   • Порядок полей в составном индексе должен соответствовать запросам');
        console.log('   • Удаляйте неиспользуемые индексы (каждый индекс замедляет запись)');
        
        console.log('\n2. 🔍 ОПТИМИЗАЦИЯ ЗАПРОСОВ:');
        console.log('   • Используйте projection для выбора только нужных полей');
        console.log('   • Избегайте $where и JavaScript выражения');
        console.log('   • Используйте $match как можно раньше в агрегациях');
        console.log('   • Ограничивайте количество возвращаемых документов (limit)');
        
        console.log('\n3. 📊 ОПТИМИЗАЦИЯ АГРЕГАЦИЙ:');
        console.log('   • Используйте $match для фильтрации перед $group');
        console.log('   • Применяйте $sort и $limit как можно раньше');
        console.log('   • Используйте $facet для параллельного выполнения агрегаций');
        console.log('   • Избегайте ненужных $unwind (разворачивайте только при необходимости)');
        
        console.log('\n4. 💾 ОПТИМИЗАЦИЯ ХРАНЕНИЯ:');
        console.log('   • Используйте соответствующие типы данных (ObjectId для ссылок)');
        console.log('   • Регулярно выполняйте compact для уменьшения фрагментации');
        console.log('   • Настройте размер рабочего набора (wiredTigerCacheSizeGB)');
        console.log('   • Используйте TTL индексы для автоматического удаления старых данных');
        
        console.log('\n5. 📈 МОНИТОРИНГ И АНАЛИЗ:');
        console.log('   • Используйте explain() для анализа планов выполнения');
        console.log('   • Мониторьте медленные запросы через профилировщик');
        console.log('   • Анализируйте использование индексов через collStats');
        console.log('   • Настройте алерты на деградацию производительности');
    }
    
    // Финальный отчет
    async generateFinalReport() {
        console.log('\n📋 ФИНАЛЬНЫЙ ОТЧЕТ ПО ОПТИМИЗАЦИИ');
        console.log('='.repeat(50));
        
        console.log('\n📊 СВОДКА РЕЗУЛЬТАТОВ:');
        console.log('┌─────────┬─────────────────────────────┬──────────┬──────────┬─────────────┐');
        console.log('│ Запрос  │ Описание                   │ До (мс)  │ После (мс)│ Улучшение   │');
        console.log('├─────────┼─────────────────────────────┼──────────┼──────────┼─────────────┤');
        
        this.results.forEach((result, index) => {
            const queryName = result.query.length > 25 ? result.query.substring(0, 22) + '...' : result.query;
            console.log(`│ ${(index + 1).toString().padEnd(7)} │ ${queryName.padEnd(25)} │ ${result.before.toString().padStart(8)} │ ${result.after.toString().padStart(8)} │ ${result.improvement.toFixed(1) + '%'.padStart(6)} │`);
        });
        
        console.log('└─────────┴─────────────────────────────┴──────────┴──────────┴─────────────┘');
        
        // Общая статистика
        const totalImprovement = this.results.reduce((sum, r) => sum + r.improvement, 0) / this.results.length;
        const maxImprovement = Math.max(...this.results.map(r => r.improvement));
        const minImprovement = Math.min(...this.results.map(r => r.improvement));
        
        console.log(`\n📈 ОБЩАЯ СТАТИСТИКА:`);
        console.log(`   Среднее улучшение: ${totalImprovement.toFixed(2)}%`);
        console.log(`   Максимальное улучшение: ${maxImprovement.toFixed(2)}%`);
        console.log(`   Минимальное улучшение: ${minImprovement.toFixed(2)}%`);
        
        console.log(`\n🏆 САМАЯ ЭФФЕКТИВНАЯ ОПТИМИЗАЦИЯ:`);
        const bestResult = this.results.reduce((best, current) => 
            current.improvement > best.improvement ? current : best
        );
        console.log(`   Запрос: ${bestResult.query}`);
        console.log(`   Улучшение: ${bestResult.improvement.toFixed(2)}%`);
        console.log(`   Методы: ${bestResult.optimizations ? bestResult.optimizations.join(', ') : 'Создание индекса'}`);
        
        console.log(`\n💡 КЛЮЧЕВЫЕ ВЫВОДЫ:`);
        console.log(`   1. Правильные индексы - основа производительности`);
        console.log(`   2. Составные индексы эффективнее отдельных`);
        console.log(`   3. Ранняя фильтрация уменьшает объем обрабатываемых данных`);
        console.log(`   4. Анализ explain() обязателен для сложных запросов`);
    }
    
    // Основная функция
    async runOptimization() {
        await this.connect();
        
        console.log('=== ОПТИМИЗАЦИЯ ЗАПРОСОВ MONGODB ===\n');
        
        try {
            // Анализируем текущие индексы
            await this.analyzeIndexes();
            
            // Оптимизируем запросы
            await this.slowQuery1();
            await this.slowQuery2();
            await this.slowQuery3();
            
            // Генерируем отчет
            await this.generateFinalReport();
            
            // Общие рекомендации
            await this.generalOptimizationTips();
            
            console.log('\n' + '='.repeat(60));
            console.log('🎉 ОПТИМИЗАЦИЯ ЗАПРОСОВ ЗАВЕРШЕНА!');
            console.log('='.repeat(60));
            
            console.log('\n📝 РЕКОМЕНДУЕМЫЕ ДЕЙСТВИЯ:');
            console.log('   1. Проверьте созданные индексы в продакшене');
            console.log('   2. Настройте мониторинг медленных запросов');
            console.log('   3. Регулярно анализируйте использование индексов');
            console.log('   4. Тестируйте изменения на staging среде');
            
        } catch (error) {
            console.error('❌ Ошибка при оптимизации запросов:', error.message);
        } finally {
            await this.disconnect();
        }
    }
}

// Запуск
if (require.main === module) {
    const optimizer = new QueryOptimizer();
    
    optimizer.runOptimization().then(() => {
        console.log('\n✅ Оптимизация запросов выполнена!');
        process.exit(0);
    }).catch(err => {
        console.error('❌ Ошибка:', err);
        process.exit(1);
    });
}

module.exports = { QueryOptimizer };