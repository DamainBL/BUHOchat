import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js';

class AuthViewModel {
    constructor(config) {
        this.app = initializeApp(config);
        this.auth = getAuth(this.app);
        this.provider = new GoogleAuthProvider();
        this.currentUser = null;
        
        this.loginOverlay = document.getElementById('login-overlay');
        this.googleLoginBtn = document.getElementById('google-login-btn');
        this.loginLoading = document.getElementById('login-loading');
        this.loginError = document.getElementById('login-error');
        
        // Desktop elements
        this.userInfoDesktop = document.getElementById('user-info-desktop');
        this.userAvatarDesktop = document.getElementById('user-avatar-desktop');
        this.userDropdownDesktop = document.getElementById('user-dropdown-desktop');
        this.dropdownAvatarDesktop = document.getElementById('dropdown-avatar-desktop');
        this.dropdownNameDesktop = document.getElementById('dropdown-name-desktop');
        this.dropdownEmailDesktop = document.getElementById('dropdown-email-desktop');
        
        // Mobile elements
        this.userInfoMobile = document.getElementById('user-info-mobile');
        this.userAvatarMobile = document.getElementById('user-avatar-mobile');
        this.userDropdownMobile = document.getElementById('user-dropdown-mobile');
        this.dropdownAvatarMobile = document.getElementById('dropdown-avatar-mobile');
        this.dropdownNameMobile = document.getElementById('dropdown-name-mobile');
        this.dropdownEmailMobile = document.getElementById('dropdown-email-mobile');
        
        this.setupEventListeners();
        this.checkSession();
    }
    
    setupEventListeners() { 
        if (this.googleLoginBtn) {
            this.googleLoginBtn.addEventListener('click', () => this.handleGoogleLogin());
        }
        
        const logoutBtnDesktop = document.getElementById('logout-btn-desktop');
        const logoutBtnMobile = document.getElementById('logout-btn-mobile');
        
        if (logoutBtnDesktop) {
            logoutBtnDesktop.addEventListener('click', () => this.handleLogout());
        }
        
        if (logoutBtnMobile) {
            logoutBtnMobile.addEventListener('click', () => this.handleLogout());
        }
        
        if (this.userAvatarDesktop) {
            this.userAvatarDesktop.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleDropdownDesktop();
            });
        }
        
        if (this.userAvatarMobile) {
            this.userAvatarMobile.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleDropdownMobile();
            });
        }
        
        document.addEventListener('click', () => {
            this.closeDropdowns();
        });
    }
    
    async handleGoogleLogin() {
        this.hideError();
        this.loginLoading.classList.remove('hidden');
        this.googleLoginBtn.disabled = true;
        
        try {
            const result = await signInWithPopup(this.auth, this.provider);
            const idToken = await result.user.getIdToken();
            
            const response = await fetch('/api/verify-token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ idToken })
            });
            
            const data = await response.json();
            
            if (response.ok && data.success) {
                this.currentUser = data.user;
                this.displayUserInfo(data.user);
                this.loginOverlay.classList.add('hidden');
                
                if (window.chatViewModel) {
                    window.chatViewModel.loadConversations();
                }
            } else {
                await signOut(this.auth);
                this.showError(data.message || data.error || 'Error al iniciar sesión');
            }
        } catch (error) {
            console.error('Error en login:', error);
            this.showError('Error al iniciar sesión. Por favor, intenta de nuevo.');
        } finally {
            this.loginLoading.classList.add('hidden');
            this.googleLoginBtn.disabled = false;
        }
    }
    
    async handleLogout() {
        try {
            await signOut(this.auth);
            await fetch('/api/logout', { method: 'POST' });
            
            this.currentUser = null;
            this.loginOverlay.classList.remove('hidden');
            
            if (this.userInfoDesktop) this.userInfoDesktop.classList.add('hidden');
            if (this.userInfoMobile) this.userInfoMobile.classList.add('hidden');
            
            if (window.chatViewModel) {
                window.chatViewModel.clearChat();
            }
        } catch (error) {
            console.error('Error al cerrar sesión:', error);
        }
    }
    
    async checkSession() {
        try {
            const response = await fetch('/api/check-session');
            const data = await response.json();
            
            if (data.authenticated) {
                this.currentUser = data.user;
                this.displayUserInfo(data.user);
            } else {
                this.loginOverlay.classList.remove('hidden');
            }
        } catch (error) {
            console.error('Error al verificar sesión:', error);
            this.loginOverlay.classList.remove('hidden');
        }
    }
    
    displayUserInfo(user) {
        const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=7b3238&color=fff`;
        const avatarUrl = user.picture || defaultAvatar;
        
        window.userAvatarUrl = avatarUrl;
        
        // Desktop
        if (this.userInfoDesktop) this.userInfoDesktop.classList.remove('hidden');
        if (this.userAvatarDesktop) this.userAvatarDesktop.src = avatarUrl;
        if (this.dropdownAvatarDesktop) this.dropdownAvatarDesktop.src = avatarUrl;
        if (this.dropdownNameDesktop) this.dropdownNameDesktop.textContent = user.name;
        if (this.dropdownEmailDesktop) this.dropdownEmailDesktop.textContent = user.email;
        
        // Mobile
        if (this.userInfoMobile) this.userInfoMobile.classList.remove('hidden');
        if (this.userAvatarMobile) this.userAvatarMobile.src = avatarUrl;
        if (this.dropdownAvatarMobile) this.dropdownAvatarMobile.src = avatarUrl;
        if (this.dropdownNameMobile) this.dropdownNameMobile.textContent = user.name;
        if (this.dropdownEmailMobile) this.dropdownEmailMobile.textContent = user.email;
    }
    
    toggleDropdownDesktop() {
        this.userDropdownDesktop?.classList.toggle('show');
        this.userDropdownDesktop?.classList.toggle('hidden');
    }
    
    toggleDropdownMobile() {
        this.userDropdownMobile?.classList.toggle('show');
        this.userDropdownMobile?.classList.toggle('hidden');
    }
    
    closeDropdowns() {
        this.userDropdownDesktop?.classList.remove('show');
        this.userDropdownDesktop?.classList.add('hidden');
        this.userDropdownMobile?.classList.remove('show');
        this.userDropdownMobile?.classList.add('hidden');
    }
    
    showError(message) {
        const errorP = this.loginError.querySelector('p');
        if (errorP) errorP.textContent = message;
        this.loginError.classList.remove('hidden');
    }
    
    hideError() {
        this.loginError.classList.add('hidden');
    }
}

export default AuthViewModel;
