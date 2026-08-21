export default {
  emailRestrictions: {
    enabled: {
      doc: 'Defines if email restrictions are enforced on new email intake',
      format: 'Boolean',
      default: false,
    },
    blockDisposableEmails: {
      doc: 'Defines if emails from known disposable providers should be blocked',
      format: 'Boolean',
      default: true,
    },
    blockPlusAddressing: {
      doc: 'Defines if plus addressing in the local part of an email should be blocked',
      format: 'Boolean',
      default: true,
    },
    blockedAddresses: {
      doc: 'Exact email addresses that are not allowed',
      format: 'Array',
      children: {
        format: 'String',
      },
      default: [],
    },
    blockedDomains: {
      doc: 'Email domains that are not allowed, including subdomains',
      format: 'Array',
      children: {
        format: 'String',
      },
      default: [],
    },
    allowedAddresses: {
      doc: 'Exact email addresses that override block, disposable, and plus-addressing rules, but not reserved anonymous.com',
      format: 'Array',
      children: {
        format: 'String',
      },
      default: [],
    },
    allowedDomains: {
      doc: 'Email domains that override block, disposable, and plus-addressing rules, including subdomains, but not reserved anonymous.com',
      format: 'Array',
      children: {
        format: 'String',
      },
      default: [],
    },
  },
};
