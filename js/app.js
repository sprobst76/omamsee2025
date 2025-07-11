import { events, rainEvents, locations, categories, festivalInfo } from './events.js';

// App state
let currentDay = '2025-07-11';
let currentTab = 'schedule';
let showRainPlan = false;
let favorites = JSON.parse(localStorage.getItem('omamsee_favorites') || '[]');
let reminders = JSON.parse(localStorage.getItem('omamsee_reminders') || '[]');
let visited = JSON.parse(localStorage.getItem('omamsee_visited') || '[]');
let ratings = JSON.parse(localStorage.getItem('omamsee_ratings') || '{}');
let notes = JSON.parse(localStorage.getItem('omamsee_notes') || '{}');
let settings = JSON.parse(localStorage.getItem('omamsee_settings') || '{"darkMode": false, "hidePast": false, "defaultReminderTime": 15}');
let searchTerm = '';
let activeFilter = 'all';
let currentRatingEventId = null;

// DOM elements
const elements = {
    eventsContainer: null,
    favoritesContainer: null,
    visitedContainer: null,
    searchInput: null,
    notification: null,
    ratingModal: null,
    nextEventWidget: null
};

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    initializeElements();
    setupEventListeners();
    applySettings();
    renderEvents();
    updateStats();
    updateNextEventWidget();
    checkReminders();
    showInstallPrompt();
    
    // Update next event every minute
    setInterval(updateNextEventWidget, 60000);
    
    // Auto-refresh events to keep times current
    setInterval(() => {
        if (currentTab === 'schedule') {
            renderEvents();
        }
    }, 60000);
});

function initializeElements() {
    elements.eventsContainer = document.getElementById('events-container');
    elements.favoritesContainer = document.getElementById('favorites-container');
    elements.visitedContainer = document.getElementById('visited-container');
    elements.searchInput = document.getElementById('search-input');
    elements.notification = document.getElementById('notification');
    elements.ratingModal = document.getElementById('rating-modal');
    elements.nextEventWidget = document.getElementById('next-event-widget');
}

function setupEventListeners() {
    // Tab navigation
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const tab = this.dataset.tab;
            switchTab(tab);
        });
    });

    // Day selection
    document.querySelectorAll('.day-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            currentDay = this.dataset.day;
            document.querySelectorAll('.day-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            renderEvents();
            updateNextEventWidget();
        });
    });

    // Weather toggle
    document.getElementById('weather-toggle').addEventListener('click', function() {
        showRainPlan = !showRainPlan;
        this.textContent = showRainPlan ? '☀️ Normalplan anzeigen' : '☔ Regenplan anzeigen';
        this.classList.toggle('rain', showRainPlan);
        renderEvents();
    });

    // Hide past toggle
    document.getElementById('hide-past-toggle').addEventListener('click', function() {
        settings.hidePast = !settings.hidePast;
        this.textContent = settings.hidePast ? '⏰ Vergangene anzeigen' : '⏰ Vergangene ausblenden';
        this.classList.toggle('rain', settings.hidePast);
        saveSettings();
        renderEvents();
    });

    // Dark mode toggle
    document.getElementById('dark-mode-toggle').addEventListener('click', function() {
        toggleDarkMode();
    });

    // Search
    elements.searchInput.addEventListener('input', function() {
        searchTerm = this.value.toLowerCase();
        renderEvents();
    });

    // Filter tags
    document.querySelectorAll('.filter-tag').forEach(tag => {
        tag.addEventListener('click', function() {
            activeFilter = this.dataset.filter;
            document.querySelectorAll('.filter-tag').forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            renderEvents();
        });
    });

    // Rating modal
    document.querySelectorAll('.rating-star').forEach(star => {
        star.addEventListener('click', function() {
            const rating = parseInt(this.dataset.rating);
            setRating(rating);
        });
    });

    // Reminder time select
    const reminderSelect = document.getElementById('reminder-time-select');
    if (reminderSelect) {
        reminderSelect.addEventListener('change', function() {
            settings.defaultReminderTime = parseInt(this.value);
            saveSettings();
        });
    }

    // Close modal when clicking outside
    elements.ratingModal.addEventListener('click', function(e) {
        if (e.target === this) {
            closeRatingModal();
        }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyboardShortcuts);

    // Touch gestures for mobile
    setupTouchGestures();

    // Online/offline status
    window.addEventListener('online', function() {
        showNotification('Verbindung wiederhergestellt');
    });

    window.addEventListener('offline', function() {
        showNotification('Offline Modus aktiviert');
    });
}

function handleKeyboardShortcuts(e) {
    if (e.ctrlKey || e.metaKey) {
        switch(e.key) {
            case '1':
                e.preventDefault();
                switchTab('schedule');
                break;
            case '2':
                e.preventDefault();
                switchTab('favorites');
                break;
            case '3':
                e.preventDefault();
                switchTab('visited');
                break;
            case '4':
                e.preventDefault();
                switchTab('info');
                break;
            case 'f':
                e.preventDefault();
                elements.searchInput.focus();
                break;
            case 'd':
                e.preventDefault();
                toggleDarkMode();
                break;
        }
    }
}

function setupTouchGestures() {
    let touchStartX = 0;
    let touchEndX = 0;

    document.addEventListener('touchstart', function(e) {
        touchStartX = e.changedTouches[0].screenX;
    });

    document.addEventListener('touchend', function(e) {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipe();
    });

    function handleSwipe() {
        const swipeThreshold = 50;
        const swipeDistance = touchEndX - touchStartX;

        if (Math.abs(swipeDistance) > swipeThreshold) {
            const tabs = ['schedule', 'favorites', 'visited', 'info'];
            const currentIndex = tabs.indexOf(currentTab);

            if (swipeDistance > 0 && currentIndex > 0) {
                // Swipe right - previous tab
                switchTab(tabs[currentIndex - 1]);
            } else if (swipeDistance < 0 && currentIndex < tabs.length - 1) {
                // Swipe left - next tab
                switchTab(tabs[currentIndex + 1]);
            }
        }
    }
}

function switchTab(tab) {
    currentTab = tab;
    
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });

    // Show/hide tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.style.display = 'none';
    });
    
    const tabElement = document.getElementById(tab + '-tab');
    if (tabElement) {
        tabElement.style.display = 'block';
    }

    // Render content based on tab
    switch(tab) {
        case 'favorites':
            renderFavorites();
            break;
        case 'visited':
            renderVisited();
            break;
        case 'info':
            updateStats();
            break;
    }
}

function renderEvents() {
    if (!elements.eventsContainer) return;
    
    const eventsToShow = showRainPlan ? rainEvents : events;
    let filteredEvents = eventsToShow.filter(event => filterEvent(event));

    // Sort by start time
    filteredEvents.sort((a, b) => a.startTime.localeCompare(b.startTime));

    // Filter past events if setting is enabled
    if (settings.hidePast) {
        const now = new Date();
        const today = now.toISOString().split('T')[0];
        const currentTime = now.toTimeString().split(' ')[0].substring(0, 5);
        
        filteredEvents = filteredEvents.filter(event => {
            if (event.date > today) return true;
            if (event.date === today && event.endTime > currentTime) return true;
            return false;
        });
    }

    elements.eventsContainer.innerHTML = filteredEvents.length > 0 
        ? filteredEvents.map(event => createEventCard(event)).join('')
        : '<p style="text-align: center; color: #6c757d; margin-top: 40px;">Keine Events gefunden</p>';
}

function filterEvent(event) {
    // Filter by day
    if (event.date !== currentDay) return false;
    
    // Filter by search term
    if (searchTerm && !event.title.toLowerCase().includes(searchTerm) && 
        !event.location.toLowerCase().includes(searchTerm) &&
        !event.instructor.toLowerCase().includes(searchTerm)) return false;
    
    // Filter by category
    if (activeFilter !== 'all' && event.category !== activeFilter) return false;
    
    return true;
}

function createEventCard(event) {
    const isFavorite = favorites.includes(event.id);
    const hasReminder = reminders.includes(event.id);
    const isVisited = visited.includes(event.id);
    const hasRating = ratings[event.id];
    const isLive = isEventLive(event);
    
    const statusIcons = [];
    if (isVisited) statusIcons.push('<span class="status-icon status-visited">✓ Besucht</span>');
    if (hasRating) statusIcons.push('<span class="status-icon status-rated">⭐ Bewertet</span>');
    
    return `
        <div class="event-card ${isLive ? 'event-live' : ''}">
            <div class="event-header">
                <div class="event-time">${event.startTime} - ${event.endTime}</div>
                <div class="event-title">${event.title}</div>
                <div class="event-location">${event.location}</div>
                ${statusIcons.length > 0 ? `<div class="event-status">${statusIcons.join('')}</div>` : ''}
            </div>
            <div class="event-actions">
                <button class="btn btn-favorite ${isFavorite ? 'active' : ''}" 
                        onclick="toggleFavorite(${event.id})">
                    ⭐ ${isFavorite ? 'Favorit' : 'Favorisieren'}
                </button>
                <button class="btn btn-remind ${hasReminder ? 'active' : ''}" 
                        onclick="toggleReminder(${event.id})">
                    🔔 ${hasReminder ? 'Aktiv' : 'Erinnern'}
                </button>
                <button class="btn btn-visited ${isVisited ? 'active' : ''}" 
                        onclick="toggleVisited(${event.id})">
                    ✓ ${isVisited ? 'Besucht' : 'Besucht?'}
                </button>
                ${isVisited ? `
                    <button class="btn btn-rate ${hasRating ? 'active' : ''}" 
                            onclick="openRatingModal(${event.id})">
                        ⭐ ${hasRating ? 'Bewertet' : 'Bewerten'}
                    </button>
                ` : ''}
            </div>
        </div>
    `;
}

function isEventLive(event) {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const currentTime = now.toTimeString().split(' ')[0].substring(0, 5);
    
    return event.date === today && 
           event.startTime <= currentTime && 
           event.endTime > currentTime;
}

function toggleFavorite(eventId) {
    if (favorites.includes(eventId)) {
        favorites = favorites.filter(id => id !== eventId);
        showNotification('Aus Favoriten entfernt');
    } else {
        favorites.push(eventId);
        showNotification('Zu Favoriten hinzugefügt');
    }
    
    localStorage.setItem('omamsee_favorites', JSON.stringify(favorites));
    renderCurrentView();
    updateStats();
    updateNextEventWidget();
}

function toggleReminder(eventId) {
    if (reminders.includes(eventId)) {
        reminders = reminders.filter(id => id !== eventId);
        showNotification('Erinnerung entfernt');
    } else {
        reminders.push(eventId);
        showNotification('Erinnerung gesetzt');
        scheduleNotification(eventId);
    }
    
    localStorage.setItem('omamsee_reminders', JSON.stringify(reminders));
    renderCurrentView();
    updateStats();
}

function toggleVisited(eventId) {
    if (visited.includes(eventId)) {
        visited = visited.filter(id => id !== eventId);
        // Also remove rating if exists
        if (ratings[eventId]) {
            delete ratings[eventId];
            localStorage.setItem('omamsee_ratings', JSON.stringify(ratings));
        }
        if (notes[eventId]) {
            delete notes[eventId];
            localStorage.setItem('omamsee_notes', JSON.stringify(notes));
        }
        showNotification('Als nicht besucht markiert');
    } else {
        visited.push(eventId);
        showNotification('Als besucht markiert');
    }
    
    localStorage.setItem('omamsee_visited', JSON.stringify(visited));
    renderCurrentView();
    updateVisitedStats();
}

function scheduleNotification(eventId) {
    const event = [...events, ...rainEvents].find(e => e.id === eventId);
    if (!event) return;

    const eventDate = new Date(event.date + 'T' + event.startTime + ':00');
    const reminderTime = new Date(eventDate.getTime() - settings.defaultReminderTime * 60 * 1000);
    const now = new Date();

    if (reminderTime > now) {
        const timeout = reminderTime.getTime() - now.getTime();
        setTimeout(() => {
            if ('Notification' in window && Notification.permission === 'granted') {
                new Notification('OM am See Erinnerung', {
                    body: `${event.title} beginnt in ${settings.defaultReminderTime} Minuten`,
                    icon: 'icon-192.png',
                    badge: 'icon-72.png'
                });
            }
            showNotification(`${event.title} beginnt in ${settings.defaultReminderTime} Minuten!`);
        }, timeout);
    }
}

function renderFavorites() {
    if (!elements.favoritesContainer) return;
    
    const favoriteEvents = [...events, ...rainEvents].filter(event => favorites.includes(event.id));

    if (favoriteEvents.length === 0) {
        elements.favoritesContainer.innerHTML = `
            <div class="favorites-empty">
                <p>💜 Noch keine Favoriten hinzugefügt</p>
                <p style="font-size: 12px; margin-top: 10px;">Markiere Events mit ⭐ um sie hier zu sehen</p>
            </div>
        `;
        return;
    }

    favoriteEvents.sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return a.startTime.localeCompare(b.startTime);
    });

    elements.favoritesContainer.innerHTML = favoriteEvents.map(event => createEventCard(event)).join('');
}

function renderVisited() {
    if (!elements.visitedContainer) return;
    
    const visitedEvents = [...events, ...rainEvents].filter(event => visited.includes(event.id));

    if (visitedEvents.length === 0) {
        elements.visitedContainer.innerHTML = `
            <div class="favorites-empty">
                <p>📝 Noch keine Events besucht</p>
                <p style="font-size: 12px; margin-top: 10px;">Markiere Events als "besucht" um sie hier zu sehen</p>
            </div>
        `;
        return;
    }

    visitedEvents.sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return a.startTime.localeCompare(b.startTime);
    });

    elements.visitedContainer.innerHTML = visitedEvents.map(event => createEventCard(event)).join('');
    updateVisitedStats();
}

function updateStats() {
    const totalEventsEl = document.getElementById('total-events');
    const totalFavoritesEl = document.getElementById('total-favorites');
    const totalVisitedEl = document.getElementById('total-visited');
    const totalRemindersEl = document.getElementById('total-reminders');
    
    if (totalEventsEl) totalEventsEl.textContent = events.length;
    if (totalFavoritesEl) totalFavoritesEl.textContent = favorites.length;
    if (totalVisitedEl) totalVisitedEl.textContent = visited.length;
    if (totalRemindersEl) totalRemindersEl.textContent = reminders.length;
}

function updateVisitedStats() {
    const visitedTotalEl = document.getElementById('visited-total');
    const visitedRatedEl = document.getElementById('visited-rated');
    const avgRatingEl = document.getElementById('avg-rating');
    const favoriteCategoryEl = document.getElementById('favorite-category');
    
    if (visitedTotalEl) visitedTotalEl.textContent = visited.length;
    
    const ratedEvents = Object.keys(ratings).length;
    if (visitedRatedEl) visitedRatedEl.textContent = ratedEvents;
    
    // Calculate average rating
    if (ratedEvents > 0) {
        const totalRating = Object.values(ratings).reduce((sum, rating) => sum + rating, 0);
        const average = (totalRating / ratedEvents).toFixed(1);
        if (avgRatingEl) avgRatingEl.textContent = average;
    } else {
        if (avgRatingEl) avgRatingEl.textContent = '-';
    }
    
    // Find favorite category
    if (visited.length > 0) {
        const visitedEvents = [...events, ...rainEvents].filter(event => visited.includes(event.id));
        const categoryCount = {};
        visitedEvents.forEach(event => {
            categoryCount[event.category] = (categoryCount[event.category] || 0) + 1;
        });
        
        const favoriteCategory = Object.keys(categoryCount).reduce((a, b) => 
            categoryCount[a] > categoryCount[b] ? a : b
        );
        
        const categoryInfo = categories.find(cat => cat.id === favoriteCategory);
        if (favoriteCategoryEl && categoryInfo) {
            favoriteCategoryEl.textContent = categoryInfo.name;
        }
    } else {
        if (favoriteCategoryEl) favoriteCategoryEl.textContent = '-';
    }
}

function updateNextEventWidget() {
    if (!elements.nextEventWidget) return;
    
    const now = new Date();
    const favoriteEvents = [...events, ...rainEvents].filter(event => favorites.includes(event.id));
    
    // Find next favorite event
    const upcomingEvents = favoriteEvents.filter(event => {
        const eventDateTime = new Date(event.date + 'T' + event.startTime + ':00');
        return eventDateTime > now;
    }).sort((a, b) => {
        const dateA = new Date(a.date + 'T' + a.startTime + ':00');
        const dateB = new Date(b.date + 'T' + b.startTime + ':00');
        return dateA - dateB;
    });
    
    if (upcomingEvents.length > 0) {
        const nextEvent = upcomingEvents[0];
        const eventDateTime = new Date(nextEvent.date + 'T' + nextEvent.startTime + ':00');
        const timeUntil = Math.ceil((eventDateTime - now) / (1000 * 60)); // minutes
        
        let timeText;
        if (timeUntil < 60) {
            timeText = `in ${timeUntil} Min`;
        } else if (timeUntil < 1440) { // less than 24 hours
            const hours = Math.floor(timeUntil / 60);
            const minutes = timeUntil % 60;
            timeText = `in ${hours}h ${minutes}m`;
        } else {
            const days = Math.floor(timeUntil / 1440);
            timeText = `in ${days} Tag${days > 1 ? 'en' : ''}`;
        }
        
        document.getElementById('next-event-time').textContent = `${nextEvent.startTime} - ${timeText}`;
        document.getElementById('next-event-title').textContent = nextEvent.title;
        document.getElementById('next-event-location').textContent = nextEvent.location;
        
        elements.nextEventWidget.style.display = 'block';
    } else {
        elements.nextEventWidget.style.display = 'none';
    }
}

function openRatingModal(eventId) {
    currentRatingEventId = eventId;
    const event = [...events, ...rainEvents].find(e => e.id === eventId);
    
    if (!event) return;
    
    document.getElementById('modal-event-title').textContent = event.title;
    document.getElementById('event-notes').value = notes[eventId] || '';
    
    // Set current rating if exists
    const currentRating = ratings[eventId] || 0;
    document.querySelectorAll('.rating-star').forEach((star, index) => {
        star.classList.toggle('active', index < currentRating);
    });
    
    elements.ratingModal.style.display = 'block';
}

function closeRatingModal() {
    elements.ratingModal.style.display = 'none';
    currentRatingEventId = null;
}

function setRating(rating) {
    document.querySelectorAll('.rating-star').forEach((star, index) => {
        star.classList.toggle('active', index < rating);
    });
}

function saveEventRating() {
    if (!currentRatingEventId) return;
    
    const activeStars = document.querySelectorAll('.rating-star.active').length;
    const eventNotes = document.getElementById('event-notes').value;
    
    if (activeStars > 0) {
        ratings[currentRatingEventId] = activeStars;
        localStorage.setItem('omamsee_ratings', JSON.stringify(ratings));
    }
    
    if (eventNotes.trim()) {
        notes[currentRatingEventId] = eventNotes.trim();
        localStorage.setItem('omamsee_notes', JSON.stringify(notes));
    }
    
    showNotification('Bewertung gespeichert');
    closeRatingModal();
    renderCurrentView();
    updateVisitedStats();
}

function renderCurrentView() {
    switch(currentTab) {
        case 'schedule':
            renderEvents();
            break;
        case 'favorites':
            renderFavorites();
            break;
        case 'visited':
            renderVisited();
            break;
    }
}

function showNotification(message) {
    if (!elements.notification) return;
    
    elements.notification.textContent = message;
    elements.notification.classList.add('show');
    
    setTimeout(() => {
        elements.notification.classList.remove('show');
    }, 3000);
}

function checkReminders() {
    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }

    // Set up reminders for existing reminder events
    reminders.forEach(eventId => {
        scheduleNotification(eventId);
    });
}

function toggleDarkMode() {
    settings.darkMode = !settings.darkMode;
    applySettings();
    saveSettings();
}

function toggleHidePast() {
    settings.hidePast = !settings.hidePast;
    applySettings();
    saveSettings();
    renderEvents();
}

function updateDefaultReminderTime() {
    const select = document.getElementById('default-reminder-time');
    if (select) {
        settings.defaultReminderTime = parseInt(select.value);
        saveSettings();
    }
}

function applySettings() {
    // Apply dark mode
    document.body.classList.toggle('dark-mode', settings.darkMode);
    
    // Update toggle states
    const darkModeToggle = document.getElementById('dark-mode-setting');
    const hidePastToggle = document.getElementById('hide-past-setting');
    const reminderSelect = document.getElementById('default-reminder-time');
    
    if (darkModeToggle) {
        darkModeToggle.classList.toggle('active', settings.darkMode);
    }
    
    if (hidePastToggle) {
        hidePastToggle.classList.toggle('active', settings.hidePast);
    }
    
    if (reminderSelect) {
        reminderSelect.value = settings.defaultReminderTime;
    }
    
    // Update reminder time in favorites tab
    const reminderTimeSelect = document.getElementById('reminder-time-select');
    if (reminderTimeSelect) {
        reminderTimeSelect.value = settings.defaultReminderTime;
    }
}

function saveSettings() {
    localStorage.setItem('omamsee_settings', JSON.stringify(settings));
}

function showInstallPrompt() {
    // Show install prompt after 5 seconds if not already installed
    setTimeout(() => {
        if (!window.matchMedia('(display-mode: standalone)').matches && 
            !localStorage.getItem('installPromptShown')) {
            const prompt = document.createElement('div');
            prompt.className = 'install-prompt';
            prompt.innerHTML = `
                <div style="font-weight: 600; margin-bottom: 5px;">📱 OM am See App</div>
                <div style="font-size: 12px; margin-bottom: 10px;">Installiere die App für die beste Erfahrung!</div>
                <div class="install-buttons">
                    <button class="install-btn primary" onclick="installApp()">Installieren</button>
                    <button class="install-btn secondary" onclick="dismissInstallPrompt()">Später</button>
                </div>
            `;
            document.body.appendChild(prompt);
        }
    }, 5000);
}

function installApp() {
    // For browsers that support beforeinstallprompt
    if (window.deferredPrompt) {
        window.deferredPrompt.prompt();
        window.deferredPrompt.userChoice.then((choiceResult) => {
            window.deferredPrompt = null;
        });
    } else {
        // Show manual instructions
        showNotification('Tippe auf die Browser-Menü → "Zum Startbildschirm hinzufügen"');
    }
    dismissInstallPrompt();
}

function dismissInstallPrompt() {
    const prompt = document.querySelector('.install-prompt');
    if (prompt) {
        prompt.remove();
    }
    localStorage.setItem('installPromptShown', 'true');
}

// PWA install prompt handling
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    window.deferredPrompt = e;
});

// Export functions to global scope for onclick handlers
window.toggleFavorite = toggleFavorite;
window.toggleReminder = toggleReminder;
window.toggleVisited = toggleVisited;
window.openRatingModal = openRatingModal;
window.closeRatingModal = closeRatingModal;
window.saveEventRating = saveEventRating;
window.setRating = setRating;
window.toggleDarkMode = toggleDarkMode;
window.toggleHidePast = toggleHidePast;
window.updateDefaultReminderTime = updateDefaultReminderTime;
window.installApp = installApp;
window.dismissInstallPrompt = dismissInstallPrompt;
