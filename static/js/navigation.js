class NavigationViewModel {
    constructor() {
        this.header = document.getElementById('main-header');
        this.scrollContainer = document.querySelector('main');
        this.navLinks = document.querySelectorAll('.nav-link');
        this.sections = document.querySelectorAll('main > section');
        this.menuToggle = document.getElementById('menu-toggle');
        this.chatSidebar = document.getElementById('chat-sidebar');
        this.chatContainer = document.getElementById('chat-container');
        
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        if (this.scrollContainer) {
            this.scrollContainer.addEventListener('scroll', () => this.handleScroll());
        }
        
        this.navLinks.forEach(link => {
            link.addEventListener('click', (e) => this.handleNavClick(e));
        });
        
        if (this.menuToggle && this.chatSidebar) {
            this.menuToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                this.chatSidebar.classList.toggle('open');
            });
        }
        
        document.addEventListener('click', (e) => {
            if (this.chatSidebar && 
                !this.chatSidebar.contains(e.target) && 
                this.menuToggle && 
                !this.menuToggle.contains(e.target) && 
                this.chatSidebar.classList.contains('open')) {
                this.chatSidebar.classList.remove('open');
            }
        });
        
        this.handleScroll();
    }
    
    handleScroll() {
        if (!this.scrollContainer || !this.header) return;
        
        if (this.scrollContainer.scrollLeft > window.innerWidth / 2) {
            this.header.classList.add('-translate-y-full');
        } else {
            this.header.classList.remove('-translate-y-full');
        }
        
        let currentSectionId = '';
        this.sections.forEach(section => {
            const sectionLeft = section.offsetLeft;
            const sectionWidth = section.offsetWidth;
            if (this.scrollContainer.scrollLeft >= sectionLeft - sectionWidth / 2) {
                currentSectionId = section.getAttribute('id');
            }
        });
        
        this.navLinks.forEach(link => {
            link.classList.remove('bg-white', 'shadow-sm', 'text-[#7b3238]');
            const linkHref = link.getAttribute('href').substring(1);
            if (linkHref === currentSectionId) {
                link.classList.add('bg-white', 'shadow-sm', 'text-[#7b3238]');
            }
        });
    }
    
    handleNavClick(e) {
        e.preventDefault();
        const targetId = e.target.getAttribute('href');
        const targetSection = document.querySelector(targetId);
        
        if (targetSection && this.scrollContainer) {
            this.scrollContainer.scrollTo({
                left: targetSection.offsetLeft,
                behavior: 'smooth'
            });
        }
    }
}

export default NavigationViewModel;
