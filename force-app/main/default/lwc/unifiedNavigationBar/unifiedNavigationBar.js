import { LightningElement, api, wire, track } from 'lwc';
import { CurrentPageReference, NavigationMixin } from 'lightning/navigation';
import { getRecord, getFieldValue } from 'lightning/uiRecordApi';
import getNavigationMenuItems from '@salesforce/apex/NavigationMenuItemsController.getNavigationMenuItems';
import isGuestUser from '@salesforce/user/isGuest';
import userId from '@salesforce/user/Id';
import basePath from '@salesforce/community/basePath';

// User fields
import USER_NAME_FIELD from '@salesforce/schema/User.Name';

// Static Resources - Desktop Logos
import DESKTOP_AGENT_LOGO from '@salesforce/resourceUrl/menuLogoAgent';
import DESKTOP_CUSTOMER_LOGO from '@salesforce/resourceUrl/menuLogoCustomer';
import DESKTOP_DEFAULT_LOGO from '@salesforce/resourceUrl/azinsurancelogo';

// Static Resources - Mobile Logos
import MOBILE_AGENT_LOGO from '@salesforce/resourceUrl/agentHamburgerMenuLogo';
import MOBILE_CUSTOMER_LOGO from '@salesforce/resourceUrl/customerHamburgerMenuLogo';
import MOBILE_DEFAULT_LOGO from '@salesforce/resourceUrl/marketingHamburgerMenuLogo';

/**
 * Unified Navigation Bar Component
 * A consolidated, efficient navigation component for Salesforce Experience Cloud
 * Replaces multiple fragmented components with a single, performant solution
 */
export default class UnifiedNavigationBar extends NavigationMixin(LightningElement) {
    // Public API Properties
    @api menuName;
    @api logoType; // Options: 'default', 'agent', 'customer'
    @api includeHome; // Note: Component always shows HOME regardless of this setting

    // Tracked State
    @track navigationItems = [];
    @track isMobileMenuOpen = false;
    @track isProfileDropdownOpen = false;
    @track currentUrl = '';

    // Private Properties
    _publishedState = 'Live';
    _isInitialized = false;
    _boundUrlChangeHandler;
    _userRecord;

    /**
     * Wire - Get User Record
     */
    @wire(getRecord, { recordId: userId, fields: [USER_NAME_FIELD] })
    wiredUser({ error, data }) {
        if (data) {
            this._userRecord = data;
        } else if (error) {
            console.error('Error fetching user data:', error);
        }
    }

    // User Info
    get currentUserName() {
        if (this._userRecord) {
            return getFieldValue(this._userRecord, USER_NAME_FIELD);
        }
        return 'User';
    }

    get currentUserId() {
        return userId;
    }

    /**
     * Component Lifecycle - Connected
     */
    connectedCallback() {
        this.currentUrl = window.location.pathname;
        this._boundUrlChangeHandler = this._handleUrlChange.bind(this);
        window.addEventListener('popstate', this._boundUrlChangeHandler);
        
        // Listen for clicks outside profile dropdown
        document.addEventListener('click', this.handleDocumentClick);
    }

    /**
     * Component Lifecycle - Disconnected
     */
    disconnectedCallback() {
        if (this._boundUrlChangeHandler) {
            window.removeEventListener('popstate', this._boundUrlChangeHandler);
        }
        document.removeEventListener('click', this.handleDocumentClick);
    }

    /**
     * Wire - Get Current Page Reference
     */
    @wire(CurrentPageReference)
    handlePageReference(pageRef) {
        if (pageRef) {
            const appState = pageRef.state?.app;
            this._publishedState = appState === 'commeditor' ? 'Draft' : 'Live';
            this.currentUrl = window.location.pathname;
        }
    }

    /**
     * Wire - Get Navigation Menu Items from Apex
     */
    @wire(getNavigationMenuItems, {
        menuName: '$menuName',
        publishedState: '$_publishedState'
    })
    handleNavigationData({ error, data }) {
        if (data && !this._isInitialized) {
            console.log('Navigation data received:', data);
            console.log('Logo type:', this.logoType);
            console.log('Desktop logo URL:', this.desktopLogo);
            this._processNavigationData(data);
            this._isInitialized = true;
            console.log('Processed navigation items:', this.navigationItems);
        } else if (error) {
            console.error('Error loading navigation menu:', error);
            this.navigationItems = [];
        }
    }

    /**
     * Process raw navigation data from Salesforce
     */
    _processNavigationData(rawData) {
        // Always add HOME item first (matching old component behavior)
        let items = [
            {
                id: 'nav-home',
                label: 'HOME',
                target: '/s/',
                type: 'HomePage',
                accessRestriction: 'LoginRequired',
                defaultListViewId: null
            }
        ];

        // Process menu items from Salesforce
        const processedItems = rawData
            .map((item, index) => ({
                id: `nav-item-${index}`,
                label: item.Label,
                target: item.Target,
                type: item.Type,
                accessRestriction: item.AccessRestriction,
                defaultListViewId: item.DefaultListViewId
            }))
            .filter(item => this._shouldShowItem(item));

        items = [...items, ...processedItems];

        // Enrich items with navigation details
        this.navigationItems = items.map(item => this._enrichNavigationItem(item));
    }

    /**
     * Determine if menu item should be shown based on access restrictions
     */
    _shouldShowItem(item) {
        if (item.accessRestriction === 'None') return true;
        if (item.accessRestriction === 'LoginRequired' && !isGuestUser) return true;
        return false;
    }

    /**
     * Enrich navigation item with computed properties
     */
    _enrichNavigationItem(item) {
        const pageRef = this._buildPageReference(item);
        const url = this._computeUrl(item, pageRef);
        const isActive = this._isItemActive(item);

        return {
            ...item,
            pageReference: pageRef,
            url: url,
            isActive: isActive,
            linkClass: this._getLinkClass(isActive)
        };
    }

    /**
     * Build Lightning Navigation PageReference
     */
    _buildPageReference(item) {
        switch (item.type) {
            case 'HomePage':
                return {
                    type: 'comm__namedPage',
                    attributes: { name: 'Home' }
                };
            
            case 'SalesforceObject':
                return {
                    type: 'standard__objectPage',
                    attributes: { objectApiName: item.target },
                    state: { filterName: item.defaultListViewId }
                };
            
            case 'InternalLink':
                return {
                    type: 'standard__webPage',
                    attributes: { url: `${basePath}${item.target}` }
                };
            
            case 'ExternalLink':
                return {
                    type: 'standard__webPage',
                    attributes: { url: item.target }
                };
            
            default:
                return null;
        }
    }

    /**
     * Compute URL for navigation item
     */
    _computeUrl(item, pageRef) {
        if (!pageRef) return '#';
        
        switch (item.type) {
            case 'HomePage':
                return basePath || '/s/';
            case 'InternalLink':
                return `${basePath}${item.target}`;
            case 'ExternalLink':
                return item.target;
            default:
                return '#';
        }
    }

    /**
     * Check if navigation item is currently active
     */
    _isItemActive(item) {
        const currentPath = this.currentUrl;
        const lastSegment = this._getLastPathSegment(currentPath);

        // Home page check
        if ((lastSegment === '/' || lastSegment === '/s') && item.target === '/s/') {
            return true;
        }

        // Target match
        return item.target === lastSegment || item.target === currentPath;
    }

    /**
     * Get last segment of path
     */
    _getLastPathSegment(path) {
        if (!path || path === '/') return '/';
        const segments = path.split('/').filter(s => s.length > 0);
        return segments.length > 0 ? `/${segments[segments.length - 1]}` : '/';
    }

    /**
     * Get CSS class for link based on active state
     */
    _getLinkClass(isActive) {
        return isActive ? 'nav-link active' : 'nav-link';
    }

    /**
     * Handle URL changes (back/forward navigation)
     */
    _handleUrlChange() {
        this.currentUrl = window.location.pathname;
        this._refreshActiveStates();
    }

    /**
     * Refresh active states for all navigation items
     */
    _refreshActiveStates() {
        this.navigationItems = this.navigationItems.map(item => ({
            ...item,
            isActive: this._isItemActive(item),
            linkClass: this._getLinkClass(this._isItemActive(item))
        }));
    }

    /**
     * Handle desktop navigation click
     */
    handleDesktopNavigation(event) {
        event.preventDefault();
        event.stopPropagation();
        
        const itemId = event.currentTarget.dataset.itemId;
        const item = this.navigationItems.find(nav => nav.id === itemId);
        
        if (item) {
            this._navigateToItem(item);
        }
    }

    /**
     * Handle mobile navigation click
     */
    handleMobileNavigation(event) {
        event.preventDefault();
        event.stopPropagation();
        
        this.isMobileMenuOpen = false;
        
        const itemId = event.currentTarget.dataset.itemId;
        const item = this.navigationItems.find(nav => nav.id === itemId);
        
        if (item) {
            this._navigateToItem(item);
        }
    }

    /**
     * Navigate to item using Lightning Navigation
     */
    _navigateToItem(item) {
        if (item.pageReference) {
            this[NavigationMixin.Navigate](item.pageReference);
            
            // Update active states after short delay
            setTimeout(() => {
                this._handleUrlChange();
            }, 100);
        } else {
            console.warn(`No navigation configured for: ${item.label}`);
        }
    }

    /**
     * Handle home navigation
     */
    navigateHome(event) {
        event.preventDefault();
        event.stopPropagation();
        
        if (this.isMobileMenuOpen) {
            this.isMobileMenuOpen = false;
        }
        
        this[NavigationMixin.Navigate]({
            type: 'comm__namedPage',
            attributes: { name: 'Home' }
        });
    }

    /**
     * Open mobile menu
     */
    openMobileMenu(event) {
        event.preventDefault();
        event.stopPropagation();
        this.isMobileMenuOpen = true;
    }

    /**
     * Close mobile menu
     */
    closeMobileMenu(event) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }
        this.isMobileMenuOpen = false;
    }

    /**
     * Stop event propagation (for mobile menu panel clicks)
     */
    stopPropagation(event) {
        event.stopPropagation();
    }

    /**
     * Handle user profile click - Toggle dropdown menu
     */
    handleUserProfileClick(event) {
        event.preventDefault();
        event.stopPropagation();
        this.isProfileDropdownOpen = !this.isProfileDropdownOpen;
    }

    /**
     * Handle logout click
     */
    handleLogout(event) {
        event.preventDefault();
        event.stopPropagation();
        
        // Navigate to logout page
        const logoutUrl = `${basePath}/secur/logout.jsp`;
        window.location.href = logoutUrl;
    }

    /**
     * Close profile dropdown when clicking outside
     */
    handleDocumentClick = (event) => {
        const profileSection = this.template.querySelector('.user-profile-section');
        if (profileSection && !profileSection.contains(event.target)) {
            this.isProfileDropdownOpen = false;
        }
    }

    /**
     * Get current user ID
     */
    get currentUserId() {
        return userId;
    }

    /**
     * Get home URL
     */
    get homeUrl() {
        return basePath || '/s/';
    }

    /**
     * Get desktop logo based on logoType (defaults to Voicebrook/customer logo)
     */
    get desktopLogo() {
        const type = this.logoType || 'customer';
        
        // Use dynamic base URL for flexibility across environments
        const baseUrl = window.location.origin;
        
        switch (type.toLowerCase()) {
            case 'agent':
                return DESKTOP_AGENT_LOGO;
            case 'customer':
            case 'default':
            default:
                // All default to customer/Voicebrook logo
                return DESKTOP_CUSTOMER_LOGO || `${baseUrl}/resource/menuLogoCustomer`;
        }
    }

    /**
     * Get mobile logo based on logoType (defaults to Voicebrook/customer logo)
     */
    get mobileLogo() {
        const type = this.logoType || 'customer';
        
        // Use dynamic base URL for flexibility across environments
        const baseUrl = window.location.origin;
        
        switch (type.toLowerCase()) {
            case 'agent':
                return MOBILE_AGENT_LOGO;
            case 'customer':
            case 'default':
            default:
                // All default to customer/Voicebrook logo
                return MOBILE_CUSTOMER_LOGO || `${baseUrl}/resource/customerHamburgerMenuLogo`;
        }
    }
}