// Mobile-specific JavaScript

// Video management for all projects
const videoConfig = [
    { id: 'threadsVideo' },
    { id: 'deepalVideo' },
    { id: 'piceVideo' },
    { id: 'ispVideo' },
    { id: 'bloomVideo' },
    { id: 'cncVideo' },
    { id: 'sasuraliVideo' },
    { id: 'newmewVideo' },
    { id: 'javaVideo' },
    { id: 'nnVideo' }
];

// Initialize videos and expand functionality
document.addEventListener('DOMContentLoaded', function() {
    videoConfig.forEach(config => {
        const video = document.getElementById(config.id);
        if (video) {
            const container = video.closest('.project-container');
            const closeButton = container.querySelector('.close-button');
            
            // Play muted by default
            video.play().catch(() => {});
            
            // Desktop hover events
            container.addEventListener('mouseenter', () => {
                if (!container.classList.contains('expanded')) {
                    video.muted = false;
                    video.currentTime = 0;
                    video.play().catch(() => {});
                }
            });
            
            container.addEventListener('mouseleave', () => {
                if (!container.classList.contains('expanded')) {
                    video.muted = true;
                }
            });
            
            // Mobile expand functionality
            container.addEventListener('click', (e) => {
                // Don't trigger if clicking close button
                if (e.target === closeButton) return;
                
                // Check if mobile
                if (window.innerWidth <= 768) {
                    if (!container.classList.contains('expanded')) {
                        // Expand this container
                        expandProject(container);
                    } else {
                        // Collapse this container
                        collapseProject(container);
                    }
                }
            });
            
            // Close button functionality
            closeButton.addEventListener('click', (e) => {
                e.stopPropagation();
                collapseProject(container);
            });
        }
    });
});

function expandProject(container) {
    // Collapse any currently expanded project
    document.querySelectorAll('.project-container.expanded').forEach(expanded => {
        if (expanded !== container) {
            collapseProject(expanded);
        }
    });
    
    // Expand the clicked container
    container.classList.add('expanded');
    const closeButton = container.querySelector('.close-button');
    const video = container.querySelector('video');
    
    closeButton.classList.remove('hidden');
    
    // Unmute and play video
    if (video) {
        video.muted = false;
        video.currentTime = 0;
        video.play().catch(() => {});
        video.style.opacity = '1';
        // Use object-fit: contain for better landscape display
        video.style.objectFit = 'contain';
    }
    
    // Show content immediately
    const content = container.querySelector('.project-content');
    if (content) {
        content.style.opacity = '1';
    }
    
    // Prevent body scroll
    document.body.style.overflow = 'hidden';
    
    // Lock orientation to landscape if supported
    if (screen.orientation && screen.orientation.lock) {
        screen.orientation.lock('landscape').catch(() => {
            // Orientation lock not supported or failed
        });
    }
}

function collapseProject(container) {
    container.classList.remove('expanded');
    const closeButton = container.querySelector('.close-button');
    const video = container.querySelector('video');
    
    closeButton.classList.add('hidden');
    
    // Mute video and reset object-fit
    if (video) {
        video.muted = true;
        video.style.objectFit = 'cover';
    }
    
    // Allow body scroll
    document.body.style.overflow = '';
    
    // Unlock orientation if locked
    if (screen.orientation && screen.orientation.unlock) {
        screen.orientation.unlock();
    }
}

// Close expanded project when clicking outside (mobile only)
document.addEventListener('click', (e) => {
    if (window.innerWidth <= 768) {
        const expandedProject = document.querySelector('.project-container.expanded');
        if (expandedProject && !expandedProject.contains(e.target)) {
            collapseProject(expandedProject);
        }
    }
});

// Handle orientation changes
window.addEventListener('orientationchange', function() {
    const expandedProject = document.querySelector('.project-container.expanded');
    if (expandedProject && window.innerWidth <= 768) {
        // Re-adjust layout on orientation change
        setTimeout(() => {
            // Force reflow to ensure proper layout
            expandedProject.style.display = 'none';
            expandedProject.offsetHeight;
            expandedProject.style.display = 'flex';
        }, 100);
    }
});