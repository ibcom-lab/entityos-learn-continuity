# entityos-learn-continuity

### Docs:
- https://docs.entityos.cloud/gettingstarted_continuity

### User Role Access:
LOGON, CORE_GET_USER_DETAILS, CORE_DATA_TRACKING_SEARCH, SETUP_SPACE_SETTINGS_SEARCH, SETUP_SPACE_SETTINGS_MANAGE & any data objects that you want to back up.

### Notes
- entityOS.cloud keeps a track of system data changes.
- You can use this tracked data to incrementally back up, create proofs etc.
- You can install a key on entityOS and get data pre-encrypted, but we recommend self-managing keys and encryption within your domain.

### Methods
|Name|Notes|Object|
|:---|:----|:-----|
|continuity-util-space-export||setup_space_settings|
|continuity-util-space-import|Set last backup reference date on your space settings in entityos.cloud. You can also store it locally.|setup_space_settings|
|continuity-get-last-backup-date|Get last backup reference date from your entityos.cloud. You can also store it locally.|setup_space_settings|
|continuity-reset-last-backup-date|Reset last backup reference date on your space settings|setup_space_settings|
|continuity-get-tracking-data|Uses settings.continuity.objects.include/exclude|core_data_tracking|
|continuity-backup-object-data|This is the code you use to get data and save to your local storage. You can hard code the object schema to get the required object data, or use core_object_search to get object schema to make it dynamic.|*As required*|

### Event Settings
- "template" - saves as a template file that can be used within https://org.entityos.app.