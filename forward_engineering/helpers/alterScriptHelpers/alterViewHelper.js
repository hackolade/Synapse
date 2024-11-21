const _ = require('lodash');

module.exports = (app, options) => {
	const { mapProperties } = app.require('@hackolade/ddl-fe-utils');
	const { checkCompModEqual } = require('./common');
	const ddlProvider = require('../../ddlProvider')(null, options, app);
	const { getTableName } = require('../general')(app);

	const getAddViewScript = view => {
		const viewSchema = { ...view, ...(view.role ?? {}) };

		const viewData = {
			name: viewSchema.code || viewSchema.name,
			keys: getKeys(viewSchema, viewSchema.compMod?.collectionData?.collectionRefsDefinitionsMap ?? {}),
			schemaData: { schemaName: viewSchema.compMod.keyspaceName },
		};
		const hydratedView = ddlProvider.hydrateView({ viewData, entityData: [view] });

		return ddlProvider.createView(hydratedView, {}, view.isActivated);
	};

	const getDeleteViewScript = view => {
		const viewName = getTableName(view.code || view.name, view?.role?.compMod?.keyspaceName);

		return ddlProvider.dropView(viewName);
	};

	const getModifiedViewScript = view => {
		const viewSchema = { ...view, ...(view.role ?? {}) };
		const schemaData = { schemaName: viewSchema.compMod.keyspaceName };
		const viewData = {
			name: viewSchema.code || viewSchema.name,
			keys: getKeys(viewSchema, viewSchema.compMod?.collectionData?.collectionRefsDefinitionsMap ?? {}),
			schemaData,
		};

		const isSelectStatementModified = !checkCompModEqual(viewSchema.compMod?.selectStatement);
		const isFieldsModifiedWithNoSelectStatement =
			!_.trim(viewSchema.selectStatement) && !_.isEmpty(view.properties);

		let alterView = '';

		if (isSelectStatementModified || isFieldsModifiedWithNoSelectStatement) {
			const hydratedView = ddlProvider.hydrateView({ viewData, entityData: [viewSchema] });
			alterView = ddlProvider.alterView(hydratedView, viewSchema.isActivated);
		}

		return [alterView].filter(Boolean).join('\n\n');
	};

	const getKeys = (viewSchema, collectionRefsDefinitionsMap) => {
		return mapProperties(viewSchema, (propertyName, schema) => {
			const definition = collectionRefsDefinitionsMap[schema.refId];

			if (!definition) {
				return ddlProvider.hydrateViewColumn({
					name: propertyName,
					isActivated: schema.isActivated,
				});
			}

			const entityName =
				_.get(definition.collection, '[0].code', '') ||
				_.get(definition.collection, '[0].collectionName', '') ||
				'';
			const dbName = _.get(definition.bucket, '[0].code') || _.get(definition.bucket, '[0].name', '');
			const name = definition.name;

			if (name === propertyName) {
				return ddlProvider.hydrateViewColumn({
					containerData: definition.bucket,
					entityData: definition.collection,
					isActivated: schema.isActivated,
					definition: definition.definition,
					entityName,
					name,
					dbName,
				});
			}

			return ddlProvider.hydrateViewColumn({
				containerData: definition.bucket,
				entityData: definition.collection,
				isActivated: schema.isActivated,
				definition: definition.definition,
				alias: propertyName,
				entityName,
				name,
				dbName,
			});
		});
	};

	return {
		getAddViewScript,
		getDeleteViewScript,
		getModifiedViewScript,
	};
};
