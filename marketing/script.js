// Smooth scrolling for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Add loading animation to primary buttons
document.querySelectorAll('.primary-button').forEach(button => {
    button.addEventListener('click', function() {
        this.innerHTML = 'Loading...';
        this.style.pointerEvents = 'none';

        // Reset after a short delay (in a real app, this would be after the action completes)
        setTimeout(() => {
            this.innerHTML = this.dataset.originalText || 'Get Started';
            this.style.pointerEvents = 'auto';
        }, 1000);
    });
});

// Simple intersection observer for fade-in animations
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('fade-in');
        }
    });
}, observerOptions);

// Observe feature cards and event cards
document.querySelectorAll('.feature-card, .event-card').forEach(card => {
    observer.observe(card);
});

// Add some CSS for the fade-in animation
const style = document.createElement('style');
style.textContent = `
    .feature-card, .event-card {
        opacity: 0;
        transform: translateY(20px);
        transition: opacity 0.6s ease, transform 0.6s ease;
    }

    .fade-in {
        opacity: 1;
        transform: translateY(0);
    }
`;
document.head.appendChild(style);

// Track button clicks for analytics (placeholder)
document.querySelectorAll('.primary-button, .cta-button').forEach(button => {
    button.addEventListener('click', function() {
        // In a real app, you'd send analytics events here
        console.log('Button clicked:', this.textContent.trim());
    });
});



