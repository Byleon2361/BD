// 5labscript/run-all-tests.js
// Скрипт для запуска всех тестов и демонстраций

const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

async function runScript(scriptName, description) {
    return new Promise((resolve, reject) => {
        console.log(`\n🚀 Запуск: ${description}`);
        console.log('='.repeat(60));
        
        const scriptPath = path.join(__dirname, scriptName);
        
        if (!fs.existsSync(scriptPath)) {
            console.log(`❌ Файл не найден: ${scriptPath}`);
            resolve(false);
            return;
        }
        
        const process = exec(`node ${scriptPath}`, (error, stdout, stderr) => {
            if (error) {
                console.error(`❌ Ошибка при выполнении ${scriptName}:`);
                console.error(stderr);
                resolve(false);
            } else {
                console.log(`✅ ${scriptName} выполнен успешно`);
                resolve(true);
            }
        });
        
        process.stdout.on('data', (data) => {
            console.log(data.toString());
        });
        
        process.stderr.on('data', (data) => {
            console.error(data.toString());
        });
    });
}

async function runAllTests() {
    console.log('=== ПОЛНАЯ ДЕМОНСТРАЦИЯ ВСЕХ ФУНКЦИОНАЛЬНОСТЕЙ MONGODB ===\n');
    
    const scripts = [
        {
            file: 'mongodb-relationships.js',
            description: 'Связи между коллекциями (1:N, M:N)'
        },
        {
            file: 'mongodb-transactions.js',
            description: 'Многошаговые транзакции'
        },
        {
            file: 'mongodb-bulk-operations.js',
            description: 'Bulk операции'
        },
        {
            file: 'schema-validation.js',
            description: 'Валидация схемы с бизнес-правилами'
        },
        {
            file: 'advanced-aggregations.js',
            description: 'Комбинированные отчеты'
        },
        {
            file: 'query-optimization.js',
            description: 'Оптимизация запросов'
        },
        {
            file: 'sharding-setup.js',
            description: 'Шардинговая инфраструктура'
        },
        {
            file: 'caching-strategy.js',
            description: 'Кэширование сложных отчетов'
        }
    ];
    
    const results = [];
    
    for (const script of scripts) {
        const success = await runScript(script.file, script.description);
        results.push({
            script: script.file,
            description: script.description,
            success: success
        });
        
        // Пауза между скриптами
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Вывод результатов
    console.log('\n' + '='.repeat(60));
    console.log('📋 ИТОГОВЫЙ ОТЧЕТ');
    console.log('='.repeat(60));
    
    let passed = 0;
    let failed = 0;
    
    results.forEach((result, index) => {
        const status = result.success ? '✅' : '❌';
        console.log(`${status} ${index + 1}. ${result.description}`);
        
        if (result.success) {
            passed++;
        } else {
            failed++;
        }
    });
    
    console.log('\n📊 СТАТИСТИКА:');
    console.log(`   Всего тестов: ${results.length}`);
    console.log(`   Успешно: ${passed}`);
    console.log(`   Неудачно: ${failed}`);
    console.log(`   Успешность: ${((passed / results.length) * 100).toFixed(1)}%`);
    
    if (failed === 0) {
        console.log('\n🎉 ВСЕ ФУНКЦИОНАЛЬНОСТИ РАБОТАЮТ КОРРЕКТНО!');
        console.log('\n💡 Запустите расширенный сервер:');
        console.log('   node 5labscript/app-enhanced.js');
        console.log('\n   Или используйте исходный сервер с новыми endpoint:');
        console.log('   node app.js');
    } else {
        console.log('\n⚠️  Некоторые тесты не прошли. Проверьте ошибки выше.');
    }
    
    console.log('\n' + '='.repeat(60));
}

// Запуск
if (require.main === module) {
    runAllTests().then(() => {
        console.log('\n✅ Все демонстрации завершены!');
        process.exit(0);
    }).catch(err => {
        console.error('❌ Критическая ошибка:', err);
        process.exit(1);
    });
}