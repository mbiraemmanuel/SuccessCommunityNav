import { LightningElement, api, wire, track } from 'lwc';
import { CurrentPageReference, NavigationMixin } from 'lightning/navigation';
import getNavigationMenuItems from '@salesforce/apex/NavigationMenuItemsController.getNavigationMenuItems';
import isGuestUser from '@salesforce/user/isGuest';
import basePath from '@salesforce/community/basePath';

// Static Resources
import HAMBURGER_ICON from '@salesforce/resourceUrl/marketingHamburgerIcon';
import X_ICON from '@salesforce/resourceUrl/marketingXIcon';
import AGENT_LOGO from '@salesforce/resourceUrl/menuLogoAgent';
import AGENT_MOBILE_LOGO from '@salesforce/resourceUrl/agentHamburgerMenuLogo';
import AZINSURANCE_LOGO from '@salesforce/resourceUrl/azinsurancelogo';
import AZINSURANCE_MOBILE_LOGO from '@salesforce/resourceUrl/marketingHamburgerMenuLogo';
import CUSTOMER_LOGO from '@salesforce/resourceUrl/menuLogoCustomer';
import CUSTOMER_MOBILE_LOGO from '@salesforce/resourceUrl/customerHamburgerMenuLogo';

export default class NavigationHeader extends NavigationMixin(LightningElement) {
    @api menuName;
    @api pageType = 'default'; // 'agent', 'customer', or 'default'
    
    @track menuItems = [];
    @track showMobileMenu = false;
    @track currentPath = '';
    
    publishedState;
    isLoaded = false;
    error;
    
    // Static resources
    hamburgerIcon = HAMBURGER_ICON;
    xIcon = X_ICON;
    homeUrl = basePath || '/s/';

    connectedCallback() {
        this.updateCurrentPath();
        // Listen for URL changes (for SPA navigation)
        window.addEventListener('popstate', this.handlePopstate);
    }

    disconnectedCallback() {
        window.removeEventListener('popstate', this.handlePopstate);
    }

    handlePopstate = () => {
        this.updateCurrentPath();
        this.updateActiveStates();
    }

    updateCurrentPath() {
        this.currentPath = window.location.pathname;
    }

    @wire(CurrentPageReference)
    setCurrentPageReference(currentPageReference) {
        if (currentPageReference) {
            const app = currentPageReference.state?.app;
            this.publishedState = app === 'commeditor' ? 'Draft' : 'Live';
        }
    }

    @wire(getNavigationMenuItems, {
        menuName: '$menuName',
        publishedState: '$publishedState'
    })
    wiredMenuItems({ error, data }) {
        if (data && !this.isLoaded) {
            this.processMenuItems(data);
            this.isLoaded = true;
            this.error = undefined;
        } else if (error) {
            this.error = error;
            this.menuItems = [];
            this.isLoaded = true;
            console.error('Navigation menu error:', JSON.stringify(error));
        }
    }

    processMenuItems(data) {
        // Default home page item
        const homeItem = {
            target: '/s/',
            label: 'HOME',
            type: 'HomePage',
            accessRestriction: 'LoginRequired',
            id: 'home-0'
        };

        // Map and filter menu items
        const items = data
            .map((item, index) => ({
                target: item.Target,
                id: `item-${index + 1}`,
                label: item.Label,
                defaultListViewId: item.DefaultListViewId,
                type: item.Type,
                accessRestriction: item.AccessRestriction
            }))
            .filter(item => 
                item.accessRestriction === 'None' || 
                (item.accessRestriction === 'LoginRequired' && !isGuestUser)
            );

        // Combine and enhance with URLs
        this.menuItems = [homeItem, ...items].map(item => {
            const pageRef = this.buildPageReference(item);
            return {
                ...item,
                pageReference: pageRef,
                href: this.generateHref(pageRef, item),
                cssClass: this.isItemActive(item) ? 'nav-link active' : 'nav-link'
            };
        });
    }

    buildPageReference(item) {
        const { type, target, defaultListViewId } = item;
        
        switch (type) {
            case 'SalesforceObject':
                return {
                    type: 'standard__objectPage',
                    attributes: {
                        objectApiName: target
                    },
                    state: {
                        filterName: defaultListViewId
                    }
                };
            case 'InternalLink':
                return {
                    type: 'standard__webPage',
                    attributes: {
                        url: basePath + target
                    }
                };
            case 'ExternalLink':
                return {
                    type: 'standard__webPage',
                    attributes: {
                        url: target
                    }
                };
            case 'HomePage':
                return {
                    type: 'comm__namedPage',
                    attributes: {
                        name: 'Home'
                    }
                };
            default:
                return null;
        }
    }

    generateHref(pageReference, item) {
        if (!pageReference) return '#';
        
        // For simple cases, return the target directly
        if (item.type === 'HomePage') return this.homeUrl;
        if (item.type === 'InternalLink') return basePath + item.target;
        if (item.type === 'ExternalLink') return item.target;
        
        return '#';
    }

    isItemActive(item) {
        const lastSegment = this.getLastSegment(this.currentPath);
        
        // Home page special case
        if ((lastSegment === '/' || lastSegment === '') && item.target === '/s/') {
            return true;
        }
        
        // Match against target
        return item.target === lastSegment || item.target === this.currentPath;
    }

    getLastSegment(path) {
        if (!path) return '/';
        const segments = path.split('/').filter(s => s.length > 0);
        return segments.length > 0 ? '/' + segments[segments.length - 1] : '/';
    }

    updateActiveStates() {
        this.updateCurrentPath();
        this.menuItems = this.menuItems.map(item => ({
            ...item,
            cssClass: this.isItemActive(item) ? 'nav-link active' : 'nav-link'
        }));
    }

    handleNavClick(event) {
        event.preventDefault();
        event.stopPropagation();
        
        const { target, type, object: objName, label } = event.currentTarget.dataset;
        const item = this.menuItems.find(i => i.label === label);
        
        if (item?.pageReference) {
            this[NavigationMixin.Navigate](item.pageReference);
            // Update active states after navigation
            setTimeout(() => this.updateActiveStates(), 100);
        } else if (label === 'VOICEBROOK SUCCESS COMMUNITY') {
            window.open('/servlet/networks/switch?networkId=0DBV100000003M5', '_blank');
        } else {
            console.warn(`Navigation type "${type}" not fully implemented for:`, label);
        }
    }

    handleMobileClick(event) {
        event.preventDefault();
        event.stopPropagation();
        
        // Close mobile menu first
        this.showMobileMenu = false;
        
        // Then handle navigation
        this.handleNavClick(event);
    }

    handleLogoClick(event) {
        event.preventDefault();
        event.stopPropagation();
        
        this[NavigationMixin.Navigate]({
            type: 'comm__namedPage',
            attributes: {
                name: 'Home'
            }
        });
        
        if (this.showMobileMenu) {
            this.showMobileMenu = false;
        }
    }

    toggleMobileMenu(event) {
        event?.preventDefault();
        event?.stopPropagation();
        this.showMobileMenu = !this.showMobileMenu;
    }

    // Logo getters based on page type
    get desktopLogo() {
        switch (this.pageType) {
            case 'agent':
                return AGENT_LOGO;
            case 'customer':
                return CUSTOMER_LOGO;
            default:
                return AZINSURANCE_LOGO;
        }
    }

    get mobileLogo() {
        switch (this.pageType) {
            case 'agent':
                return AGENT_MOBILE_LOGO;
            case 'customer':
                return CUSTOMER_MOBILE_LOGO;
            default:
                return AZINSURANCE_MOBILE_LOGO;
        }
    }
}
