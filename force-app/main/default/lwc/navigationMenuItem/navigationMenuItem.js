import { LightningElement, api, track } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import basePath from '@salesforce/community/basePath';

export default class NavigationMenuItem extends NavigationMixin(
    LightningElement
) {
    @api item = {};
    @track active = false;
    @track href = '#';

    pageReference;
    handlePopstateBound; // Property to store the bound function

    connectedCallback() {
        this.handlePopstateBound = this.setActiveStatus.bind(this); // Store the bound function

        window.addEventListener('popstate', this.handlePopstateBound);

        const observer = new MutationObserver(() => {
            this.setActiveStatus();
        });

        observer.observe(document, { childList: true, subtree: true });

        this.setActiveStatus();
        this.setPageReference();
        this.generateUrl();
    }

    disconnectedCallback() {
        window.removeEventListener('popstate', this.handlePopstateBound); // Use the stored function
    }

    handleClick(evt) {
        evt.stopPropagation();
        evt.preventDefault();
        const itemLabel = this.item.label;
        if (this.pageReference) {
            this[NavigationMixin.Navigate](this.pageReference);
        } else if(itemLabel === 'VOICEBROOK SUCCESS COMMUNITY'){
            window.open('/servlet/networks/switch?networkId=0DBV100000003M5', '_blank');
        }
        else {
            console.log(
                `Navigation menu type "${this.item.type}" not implemented for item ${JSON.stringify(this.item)}`
            );
        }
    }

    get getClasses() {
        let classes = 'navbar-item-link';
        if (this.active) {
            classes += ' active';
        }
        return classes;
    }

    getLastSegment(url) {
        const segments = url.split('/');
        const lastSegment = segments[segments.length - 1];
        return '/' + lastSegment;
    }

    setActiveStatus() {
        const currentPath = window.location.pathname;
        const lastSegment = this.getLastSegment(currentPath);
        if (lastSegment == '/' && this.item.target == '/s/') {
            this.active = true;
            return;
        }
        this.active = this.item.target == lastSegment;
    }

    setPageReference() {
        const { type, target, defaultListViewId } = this.item;
        if (type === 'SalesforceObject') {
            this.pageReference = {
                type: 'standard__objectPage',
                attributes: {
                    objectApiName: target
                },
                state: {
                    filterName: defaultListViewId
                }
            };
        } else if (type === 'InternalLink') {
            this.pageReference = {
                type: 'standard__webPage',
                attributes: {
                    url: basePath + target
                }
            };
        } else if (type === 'ExternalLink') {
            this.pageReference = {
                type: 'standard__webPage',
                attributes: {
                    url: target
                }
            };
        } else if (type === "HomePage") {
            this.pageReference = {
                type: 'comm__namedPage',
                attributes: {
                    name: 'Home'
                }
            };
        }
    }

    generateUrl() {
        if (this.pageReference) {
            this[NavigationMixin.GenerateUrl](this.pageReference).then(
                (url) => {
                    this.href = url;
                }
            );
        }
    }
}