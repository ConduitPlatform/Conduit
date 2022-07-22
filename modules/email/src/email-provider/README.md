# An Email provider library

This library can be used with anything really.

###### You need to know

* Each template has multiple versions except Mandrill. Mandrill has only one version.
* Each template **can be accessed with its id member** and not with its name.

###### CreateTemplate()

* Takes as an argument an object of type **CreateEmailTemplate**

###### Sendgrid

* **VersionName** is required when you create a new Template

###### Mailgun 

* PlainContent and HtmlContent are same. Mailgun provides only one way to fill the content property , so you can write html code or text. So **_assign  this content to  ***plainContent*** member_**.
* Mailgun **does not provide _subject_** option when you create a template. You have to set it when you send the email.
