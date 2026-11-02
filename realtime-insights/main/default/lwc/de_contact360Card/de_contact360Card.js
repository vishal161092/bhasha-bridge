import { LightningElement, api, wire } from 'lwc';
import { getRecord } from 'lightning/uiRecordApi';

const FIELDS = [
    'Contact.Name',
    'Contact.Email',
    'Contact.Phone',
    'Contact.Title',
    'Contact.Department',
    'Contact.Occupation__c',
    'Contact.MailingStreet',
    'Contact.MailingCity',
    'Contact.MailingState',
    'Contact.MailingPostalCode',
    'Contact.AccountId',
    'Contact.Account.Name'
];

export default class De_contact360Card extends LightningElement {
    @api recordId;

    contactData = {};
    hasError = false;

    @wire(getRecord, { recordId: '$recordId', fields: FIELDS })
    wiredContact({ error, data }) {
        if (data) {
            this.hasError = false;
            const f = data.fields;
            this.contactData = {
                name: f.Name?.value || '',
                email: f.Email?.value || '',
                phone: f.Phone?.value || '',
                title: f.Title?.value || '',
                department: f.Department?.value || '',
                occupation: f.Occupation__c?.value || '',
                street: f.MailingStreet?.value || '',
                city: f.MailingCity?.value || '',
                state: f.MailingState?.value || '',
                postalCode: f.MailingPostalCode?.value || '',
                accountName: f.Account?.value?.fields?.Name?.value || ''
            };
        } else if (error) {
            this.hasError = true;
            console.error('Contact 360 wire error:', error);
        }
    }

    get hasData() {
        return this.contactData.name !== '';
    }

    get fullAddress() {
        const parts = [
            this.contactData.city,
            this.contactData.state,
            this.contactData.postalCode
        ].filter(Boolean);
        return parts.join(', ');
    }

    get initials() {
        const name = this.contactData.name || '';
        const parts = name.split(' ');
        if (parts.length >= 2) {
            return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    }

    get badges() {
        const list = [];
        if (this.contactData.occupation) list.push(this.contactData.occupation);
        if (this.contactData.department) list.push(this.contactData.department);
        if (this.contactData.accountName) list.push(this.contactData.accountName);
        return list;
    }

    get hasBadges() {
        return this.badges.length > 0;
    }
}
