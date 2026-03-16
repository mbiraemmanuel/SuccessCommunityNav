import { LightningElement, api, wire, track } from 'lwc';
import { CurrentPageReference, NavigationMixin } from 'lightning/navigation';
import HAMBURGER_ICON from '@salesforce/resourceUrl/marketingHamburgerIcon';
import X_ICON from '@salesforce/resourceUrl/marketingXIcon';
import getNavigationMenuItems from '@salesforce/apex/NavigationMenuItemsController.getNavigationMenuItems';
import isGuestUser from '@salesforce/user/isGuest';
import basePath from '@salesforce/community/basePath';

export default class NavigationMenu extends NavigationMixin(LightningElement) {
    @api menuName;
    @track urlName;

    error;
    href = basePath;
    isLoaded;
    menuItems = [];
    publishedState;
    showHamburgerMenu;


    hamburgerIcon = HAMBURGER_ICON;
    xIcon = X_ICON;

    @wire(CurrentPageReference)
    setCurrentPageReference(currentPageReference) {
        if (currentPageReference) {
            const app = currentPageReference.state && currentPageReference.state.app;
            this.urlName = currentPageReference.attributes.urlName;
            if (app === 'commeditor') {
                this.publishedState = 'Draft';
            } else {
                this.publishedState = 'Live';
            }
        }
    }

    @wire(getNavigationMenuItems, {
        menuName: '$menuName',
        publishedState: '$publishedState'
    })
    wiredMenuItems({ error, data }) {
        if (data && !this.isLoaded) {
            // Define the default home page item
            let defaultHomePage = {
                target: '/s/',
                label: 'HOME',
                position: 1,
                defaultListViewId: 1,
                type: 'HomePage',
                accessRestriction: 'LoginRequired'
            };

            // Map and filter the menu items
            let menuItems = data
                .map((item, index) => {
                    return {
                        target: item.Target,
                        id: index,
                        label: item.Label,
                        defaultListViewId: item.DefaultListViewId,
                        type: item.Type,
                        accessRestriction: item.AccessRestriction
                    };
                })
                .filter((item) => {
                    // Only show "Public" items if guest user
                    return (
                        item.accessRestriction === 'None' ||
                        (item.accessRestriction === 'LoginRequired' &&
                            !isGuestUser)
                    );
                });

            // Prepend the default home page to the menu items
            this.menuItems = [defaultHomePage, ...menuItems];

            this.error = undefined;
            this.isLoaded = true;
        } else if (error) {
            this.error = error;
            this.menuItems = [];
            this.isLoaded = true;
            console.log(`Navigation menu error: ${JSON.stringify(this.error)}`);
        }
    }
    handleNavigation() {

        const navigationMenuItems = this.template.querySelectorAll('c-navigation-menu-item');
        navigationMenuItems.forEach(item => {
            item.recheckActiveStatus();
        });

    }
    handleHamburgerMenuToggle(evt) {
        evt.stopPropagation();
        evt.preventDefault();
        this.showHamburgerMenu = !this.showHamburgerMenu;
    }
}