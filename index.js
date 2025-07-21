/*
	entityos Continuity example app for an organisation;
	- https://docs.entityos.cloud/gettingstarted_continuity

	Design Notes:

	# You need to set up a user role with access to:
	LOGON, CORE_GET_USER_DETAILS, CORE_DATA_TRACKING_SEARCH, SETUP_SPACE_SETTINGS_SEARCH, SETUP_SPACE_SETTINGS_MANAGE
	& any data objects that you want to back up.
	
  	To run local use https://www.npmjs.com/package/lambda-local:

	lambda-local -l index.js -t 9000 -e events/event-continuity-get-last-backup-date.json
	 - Get last back up date

	lambda-local -l index.js -t 9000 -e events/event-continuity-reset-last-backup-date.json
	 - Reset last back up date

	lambda-local -l index.js -t 9000 -e events/event-continuity-get-tracking-data.json
	 - Get tracking data

	lambda-local -l index.js -t 9000 -e events/event-continuity-backup-object-data.json
	 - !!! The main controller that does the back up

	# util-controllers:

	lambda-local -l index.js -t 9000 -e events/event-continuity-util-space-export-data.json
	 - export data

	lambda-local -l index.js -t 9000 -e events/event-continuity-util-space-import-data.json
	 - import data
*/

exports.handler = function (event, context, callback)
{
	var entityos = require('entityos')
	var _ = require('lodash')
	var moment = require('moment');

	entityos.set(
	{
		scope: '_event',
		value: event
	});

	entityos.set(
	{
		scope: '_context',
		value: context
	});

	entityos.set(
	{
		scope: '_callback',
		value: callback
	});

	var settings;

	if (event != undefined)
	{
		if (event.site != undefined)
		{
			settings = event.site;
			//ie use settings-[event.site].json
		}
	}

	entityos.init(main, settings);

	function main(err, data)
	{
		entityos.add(
		{
			name: 'continuity-start',
			code: function (param)
			{
				var event = entityos.get(
				{
					scope: '_event'
				});

				var settings = entityos.get(
				{
					scope: '_settings'
				});

				var controller;

				if (_.isObject(event))
				{
					controller = event.controller;
				}

				if (controller != undefined)
				{
					entityos._util.message(
					[
						'-',
						'Using entityos module version ' + entityos.VERSION,
						'-',
						'Settings:',
						settings,
						'-',
						'Based on event data invoking controller:',
						controller
					]);

					if (_.startsWith(controller, 'continuity-util-space-export'))
					{
						var continuityfactoryUtilSpaceExport = require('continuityfactory/continuityfactory-util-space-export.js');
						continuityfactoryUtilSpaceExport.init();
					}

					if (_.startsWith(controller, 'continuity-util-space-import'))
					{
						var continuityfactoryUtilSpaceImport = require('continuityfactory/continuityfactory-util-space-import.js');
						continuityfactoryUtilSpaceImport.init();
					}

					entityos.invoke(controller);
				}
			}
		});

		//--- GET LAST BACKUP REFERENCE DATE FROM YOUR entityos.CLOUD SPACE SETTINGS

		entityos.add(
		[
			{
				name: 'continuity-get-last-backup-date',
				code: function (param)
				{
					entityos.cloud.search(
					{
						object: 'setup_space_settings',
						fields: [{ name: 'datatrackinglastbackupdate' }],
						callback: 'continuity-get-last-backup-date-response',
						callbackParam: param
					});
				}
			},
			{
				name: 'continuity-get-last-backup-date-response',
				code: function (param, response)
				{
					if (response.status == 'OK')
					{
						entityos.set(
						{
							scope: 'continuity',
							context: 'space-settings',
							value: _.first(response.data.rows)
						});

						var lastBackupDate = entityos.set(
						{
							scope: 'continuity-get-last-backup-date',
							context: 'last-backup-date',
							value: _.first(response.data.rows).datatrackinglastbackupdate
						});

						entityos._util.message(
						[
							'-',
							'Last backup date:',
							lastBackupDate
						]);

						var onComplete = entityos._util.param.get(param, 'onComplete').value;

						if (onComplete != undefined)
						{
							entityos._util.onComplete(param);
						}
						else
						{
							entityos.invoke('util-end',
							{
								status: 'OK',
								lastBackupDate: lastBackupDate
							});
						}
					}
				}
			}
		]);

		//--- GET TRACKING DATA FROM entityos.CLOUD

		entityos.add(
		[
			{
				name: 'continuity-get-tracking-data',
				code: function (param)
				{
					entityos.invoke('continuity-get-last-backup-date',
					{
						onComplete: 'continuity-get-tracking-data-process'
					})
				}
			},
			{
				name: 'continuity-get-tracking-data-process',
				code: function (param)
				{
					var settings = entityos.get(
					{
						scope: '_settings'
					});

					//use for settings.continuity.objects.include / exclude

					var lastBackupDate = entityos.get(
					{
						scope: 'continuity-get-last-backup-date',
						context: 'last-backup-date'
					});

					var filters = [];

					if (settings.continuity.filters != undefined)
					{
						filters = _.concat(filters, settings.continuity.filters)
					}

					if (lastBackupDate != '' && lastBackupDate != undefined)
					{
						filters.push(
						{
							field: 'modifieddate',
							comparison: 'GREATER_THAN',
							value: lastBackupDate
						});
					}

					if (settings.continuity.objects != undefined)
					{
						if (settings.continuity.objects.include != undefined)
						{
							filters.push(
							{
								field: 'object',
								comparison: 'IN_LIST',
								value: settings.continuity.objects.include
							});
						}
						else if (settings.continuity.objects.exclude != undefined)
						{
							filters.push(
							{
								field: 'object',
								comparison: 'NOT_IN_LIST',
								value: settings.continuity.objects.exclude
							});
						}
					}

					entityos.cloud.search(
					{
						object: 'core_data_tracking',
						fields:
						[
							{name: 'object'},
							{name: 'objecttext'},
							{name: 'objectcontext'},
							{name: 'modifieddate'},
							{name: 'modifieduser'},
							{name: 'modifiedusertext'},
							{name: 'session'},
							{name: 'guid'}
						],
						filters: filters,
						sorts: [{name: 'id', direction: 'asc'}],
						callback: 'continuity-get-tracking-data-process-response',
						callbackParam: param
					});
				}
			},
			{
				name: 'continuity-get-tracking-data-process-response',
				code: function (param, response)
				{
					if (response.status == 'OK')
					{
						var trackingData = entityos.set(
						{
							scope: 'continuity-get-tracking-data-process',
							context: 'data',
							value: response.data.rows
						});

						entityos.set(
						{
							scope: 'continuity-get-tracking-data-process',
							context: 'data-count',
							value: response.data.rows.length
						});

						entityos._util.message(
						[
							'-',
							'Tracking Data:',
							trackingData
						]);

						var lastTrackingData;

						if (trackingData.length != 0)
						{
							lastTrackingData = _.last(trackingData);
							var lastBackupDate = lastTrackingData.modifieddate;
						
							entityos.set(
							{
								scope: 'continuity-get-tracking-data-process',
								context: 'last-backup-date',
								value: lastBackupDate
							});
						}
					}

					entityos.invoke('continuity-backup-object-data');
				}
			}
		]);

		//--- SET LAST BACKUP REFERENCE DATE ON YOUR SPACE SETTINGS IN entityos.CLOUD

		entityos.add(
		[
			{
				name: 'continuity-set-last-backup-date',
				code: function (param)
				{
					var trackingLastBackupDate = entityos.get(
					{
						scope: 'continuity-get-tracking-data-process',
						context: 'last-backup-date'
					});

					if (trackingLastBackupDate != undefined)
					{
						var spaceSettings = entityos.get(
						{
							scope: 'continuity',
							context: 'space-settings'
						});

						entityos.cloud.save(
						{
							object: 'setup_space_settings',
							data:
							{ 
								id: spaceSettings.id,
								datatrackinglastbackupdate: trackingLastBackupDate
							},
							callback: 'continuity-set-last-backup-date-response',
							callbackParam: param
						});
					}
				}
			},
			{
				name: 'continuity-set-last-backup-date-response',
				code: function (param, response)
				{
					if (response.status == 'OK')
					{
						var onComplete = entityos._util.param.get(param, 'onComplete').value;

						if (onComplete != undefined)
						{
							entityos._util.onComplete(param);
						}
						else
						{
							entityos.invoke('util-end');
						}
					}
				}
			}
		]);

		//--- RESET LAST BACKUP REFERENCE DATE ON YOUR SPACE SETTINGS

		entityos.add(
		{
			name: 'continuity-reset-last-backup-date',
			code: function (param)
			{
				entityos.cloud.save(
				{
					object: 'setup_space_settings',
					data:
					{ 
						datatrackinglastbackupdate: ''
					}
				});
			}
		});

		//--- GET OBJECT DATA FROM ENTITYOS AND BACK UP
		// Now that you have the tracking data - you search for the data you want to save to your own data store - ie AWS S3, DynamoDB ....
		// You can use settings.local to store your own parameters
		// You can similar methods as used at https://learn.entityos.cloud/schema to get available fields etc

		entityos.add(
		[
			{
				name: 'continuity-backup-object-data',
				notes: 'This is the code you use to get data and save to your local code',
				code: function (param, response)
				{
					var trackingProcessData = entityos.get(
					{
						scope: 'continuity-get-tracking-data-process',
						context: 'data'
					});

					var trackingProcessDataByObject = _.groupBy(trackingProcessData, function (data) {return data.object});

					var trackingBackups = [];

					_.each(trackingProcessDataByObject, function (objectData, object)
					{
						trackingBackups.push(
						{
							object: object,
							objectcontexts: _.join(_.map(objectData, function (_objectData) {return _objectData.objectcontext}), ',')
						})
					});

					entityos._util.message(
					[
						'Tracking backups:',
						trackingBackups
					]);

					entityos.set(
					{
						scope: 'continuity-backup-object-data',
						context: 'tracking-backups',
						value: trackingBackups
					});

					entityos.set(
					{
						scope: 'continuity-backup-object-data',
						context: 'tracking-backups-index',
						value: 0
					});

					entityos.invoke('continuity-backup-object-data-process')
				}
			},
			{
				name: 'continuity-backup-object-data-process',
				code: function (param, response)
				{
					var index = entityos.get(
					{
						scope: 'continuity-backup-object-data',
						context: 'tracking-backups-index'
					});

					var trackingBackups = entityos.get(
					{
						scope: 'continuity-backup-object-data',
						context: 'tracking-backups'
					});

					if (index < trackingBackups.length)
					{
						var trackingBackup = trackingBackups[index];

						// Can use CORE_OBJECT_SEARCH &advancedsearchmethod to get method details to get data
						// In this example it is coded.

						var searchData =
						{
							callback: 'continuity-backup-object-data-next',
							callbackParam: param,
							rows: 9999999
						};

						const settings = entityos.get({scope: '_settings'});

						if (trackingBackup.object == 32)
						{
							searchData.object = 'contact_person';
							
							searchData.fields = _.get(settings, 'continuity.schema.contact_person',
							[
								{name: 'firstname'},
								{name: 'surname'},
								{name: 'email'}
							]);

							searchData.filters =
							[
								{
									name: 'id',
									comparison: 'IN_LIST',
									values: searchData.objectcontexts
								}
							]
						}

						entityos.cloud.search(searchData);
					}
					else
					{
						//For testing; entityos.invoke('util-end');
						entityos.invoke('continuity-set-last-backup-date');
					}
				}
			},
			{
				name: 'continuity-backup-object-data-next',
				code: function (param, response)
				{
					//use response object to save your data

					var index = entityos.get(
					{
						scope: 'continuity-backup-object-data',
						context: 'tracking-backups-index'
					});

					entityos.set(
					{
						scope: 'continuity-backup-object-data',
						context: 'tracking-backups-index',
						value: (index + 1)
					});

					entityos.invoke('continuity-backup-object-data-process')
				}
			}
		]);

		//-- UTIL controllers

		entityos.add(
		{
			name: 'util-end',
			code: function (data, error)
			{
				var callback = entityos.get(
				{
					scope: '_callback'
				});

				if (error == undefined) {error = null}

				if (data == undefined)
				{
					var trackingProcessData = entityos.get(
					{
						scope: 'continuity-get-tracking-data-process'
					});

					data =
					{
						status: 'OK',
						trackingDataCount: trackingProcessData['data-count'],
						trackingLastBackupDate: trackingProcessData['last-backup-date']
					}
				}

				if (callback != undefined)
				{
					callback(error, data);
				}
			}
		});

		entityos.add(
		{
			name: 'util-save-to-file',
			code: function (param, data)
			{
				var event = entityos.get({scope: '_event'});
				var filename = entityos._util.param.get(param, 'filename', {default: 'data.json'}).value;
				var scope = entityos._util.param.get(param, 'scope', {default: 'util-save-to-file'}).value;
				var fileData = entityos._util.param.get(param, 'fileData').value;
				var saveAsJSON = entityos._util.param.get(param, 'saveAsJSON', {default: true}).value;
				
				if (fileData == undefined)
				{
					fileData = entityos.get({scope: scope})
				}

				if (fileData != undefined)
				{
					const fs = require('fs');

					var fileDataSave = fileData;
					
					if (saveAsJSON)
					{
						try
						{
							fileDataSave = JSON.stringify(fileDataSave, null, 4);
						}
						catch (error) {}
					}

					try
					{
						fs.writeFileSync(filename, fileDataSave);
						entityos._util.onComplete(param);
					}
					catch (error)
					{
						console.error(error);
						entityos._util.onComplete(param);
					}
				}
			}
		});

		entityos.invoke('continuity-start');
	}
}