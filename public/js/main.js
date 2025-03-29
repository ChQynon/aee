document.addEventListener('DOMContentLoaded', function() {
    // Кнопки управления ботом
    const restartButton = document.getElementById('restart-bot');
    const stopButton = document.getElementById('stop-bot');
    
    // Обработчик для кнопки перезапуска
    if (restartButton) {
        restartButton.addEventListener('click', function() {
            if (confirm('Вы уверены, что хотите перезапустить бота?')) {
                showNotification('Отправка команды перезапуска...', 'info');
                
                fetch('/api/restart', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        showNotification('Бот успешно перезапущен!', 'success');
                        updateBotStatus(true);
                        setTimeout(() => {
                            window.location.reload();
                        }, 2000);
                    } else {
                        showNotification('Ошибка при перезапуске: ' + data.message, 'error');
                    }
                })
                .catch(error => {
                    showNotification('Ошибка соединения: ' + error, 'error');
                });
            }
        });
    }
    
    // Обработчик для кнопки остановки
    if (stopButton) {
        stopButton.addEventListener('click', function() {
            if (confirm('Вы уверены, что хотите остановить бота?')) {
                showNotification('Отправка команды остановки...', 'info');
                
                fetch('/api/stop', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        showNotification('Бот успешно остановлен!', 'success');
                        updateBotStatus(false);
                    } else {
                        showNotification('Ошибка при остановке: ' + data.message, 'error');
                    }
                })
                .catch(error => {
                    showNotification('Ошибка соединения: ' + error, 'error');
                });
            }
        });
    }
    
    // Обновление статуса бота в интерфейсе
    function updateBotStatus(isRunning) {
        const statusCard = document.querySelector('.status-card');
        const statusIcon = document.querySelector('.status-icon i');
        const statusTitle = document.querySelector('.status-info h2');
        
        if (isRunning) {
            statusCard.classList.add('running');
            statusCard.classList.remove('stopped');
            statusIcon.classList.remove('fa-circle-stop');
            statusIcon.classList.add('fa-circle-play');
            statusTitle.textContent = 'Статус: Работает';
            stopButton.disabled = false;
        } else {
            statusCard.classList.remove('running');
            statusCard.classList.add('stopped');
            statusIcon.classList.remove('fa-circle-play');
            statusIcon.classList.add('fa-circle-stop');
            statusTitle.textContent = 'Статус: Остановлен';
            stopButton.disabled = true;
        }
    }
    
    // Система уведомлений
    function showNotification(message, type = 'info') {
        // Создаем элемент уведомления
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        
        // Задаем иконку в зависимости от типа
        let icon = 'info-circle';
        if (type === 'success') icon = 'check-circle';
        if (type === 'error') icon = 'exclamation-circle';
        if (type === 'warning') icon = 'exclamation-triangle';
        
        notification.innerHTML = `
            <div class="notification-icon">
                <i class="fas fa-${icon}"></i>
            </div>
            <div class="notification-message">${message}</div>
            <div class="notification-close">
                <i class="fas fa-times"></i>
            </div>
        `;
        
        // Добавляем стили для уведомления
        notification.style.position = 'fixed';
        notification.style.bottom = '20px';
        notification.style.right = '20px';
        notification.style.backgroundColor = '#fff';
        notification.style.padding = '15px 20px';
        notification.style.borderRadius = '8px';
        notification.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
        notification.style.display = 'flex';
        notification.style.alignItems = 'center';
        notification.style.zIndex = '9999';
        notification.style.minWidth = '300px';
        notification.style.opacity = '0';
        notification.style.transform = 'translateY(20px)';
        notification.style.transition = 'all 0.3s ease-in-out';
        
        // Стили для иконки
        const iconColors = {
            info: 'var(--secondary-color)',
            success: 'var(--success-color)',
            error: 'var(--danger-color)',
            warning: 'var(--warning-color)'
        };
        
        notification.querySelector('.notification-icon').style.marginRight = '15px';
        notification.querySelector('.notification-icon').style.fontSize = '1.3rem';
        notification.querySelector('.notification-icon').style.color = iconColors[type];
        
        // Стили для сообщения
        notification.querySelector('.notification-message').style.flex = '1';
        
        // Стили для кнопки закрытия
        notification.querySelector('.notification-close').style.marginLeft = '15px';
        notification.querySelector('.notification-close').style.cursor = 'pointer';
        notification.querySelector('.notification-close').style.opacity = '0.7';
        
        // Добавляем уведомление в DOM
        document.body.appendChild(notification);
        
        // Анимируем появление
        setTimeout(() => {
            notification.style.opacity = '1';
            notification.style.transform = 'translateY(0)';
        }, 10);
        
        // Обработчик для закрытия уведомления
        notification.querySelector('.notification-close').addEventListener('click', () => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateY(20px)';
            
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        });
        
        // Автоматически закрываем уведомление через 5 секунд
        setTimeout(() => {
            if (document.body.contains(notification)) {
                notification.style.opacity = '0';
                notification.style.transform = 'translateY(20px)';
                
                setTimeout(() => {
                    if (document.body.contains(notification)) {
                        document.body.removeChild(notification);
                    }
                }, 300);
            }
        }, 5000);
    }
}); 