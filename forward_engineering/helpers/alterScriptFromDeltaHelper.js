const getAlterContainersScripts = (collection, app, options) => {
	const { getAddContainerScript, getDeleteContainerScript } = require('./alterScriptHelpers/alterContainerHelper')(
		app,
		options,
	);

	const addedContainers = collection.properties?.containers?.properties?.added?.items;
	const deletedContainers = collection.properties?.containers?.properties?.deleted?.items;

	const addContainersScripts = []
		.concat(addedContainers)
		.filter(Boolean)
		.map(container => ({ ...Object.values(container.properties)[0], name: Object.keys(container.properties)[0] }))
		.map(getAddContainerScript);
	const deleteContainersScripts = []
		.concat(deletedContainers)
		.filter(Boolean)
		.map(container => getDeleteContainerScript(Object.keys(container.properties)[0]));

	return [].concat(addContainersScripts).concat(deleteContainersScripts);
};

const getAlterCollectionsScripts = (collection, app, options) => {
	const {
		getAddCollectionScript,
		getDeleteCollectionScript,
		getAddColumnScript,
		getDeleteColumnScript,
		getModifyColumnScript,
		getModifyCollectionScript,
	} = require('./alterScriptHelpers/alterEntityHelper')(app, options);

	const createCollectionsScripts = []
		.concat(collection.properties?.entities?.properties?.added?.items)
		.filter(Boolean)
		.map(item => Object.values(item.properties)[0])
		.filter(collection => collection.compMod?.created)
		.map(getAddCollectionScript);
	const deleteCollectionScripts = []
		.concat(collection.properties?.entities?.properties?.deleted?.items)
		.filter(Boolean)
		.map(item => Object.values(item.properties)[0])
		.filter(collection => collection.compMod?.deleted)
		.map(getDeleteCollectionScript);
	const modifyCollectionScripts = []
		.concat(collection.properties?.entities?.properties?.modified?.items)
		.filter(Boolean)
		.map(item => Object.values(item.properties)[0])
		.filter(collection => collection.compMod?.modified)
		.map(getModifyCollectionScript);
	const addColumnScripts = []
		.concat(collection.properties?.entities?.properties?.added?.items)
		.filter(Boolean)
		.map(item => Object.values(item.properties)[0])
		.filter(collection => !collection.compMod?.created)
		.flatMap(getAddColumnScript);
	const deleteColumnScripts = []
		.concat(collection.properties?.entities?.properties?.deleted?.items)
		.filter(Boolean)
		.map(item => Object.values(item.properties)[0])
		.filter(collection => !collection.compMod?.deleted)
		.flatMap(getDeleteColumnScript);
	const modifyColumnScript = []
		.concat(collection.properties?.entities?.properties?.modified?.items)
		.filter(Boolean)
		.map(item => Object.values(item.properties)[0])
		.flatMap(getModifyColumnScript);

	return [
		...createCollectionsScripts,
		...deleteCollectionScripts,
		...modifyCollectionScripts,
		...addColumnScripts,
		...deleteColumnScripts,
		...modifyColumnScript,
	]
		.filter(Boolean)
		.map(script => script.trim());
};

const getAlterViewScripts = (collection, app, options) => {
	const { getAddViewScript, getDeleteViewScript, getModifiedViewScript } =
		require('./alterScriptHelpers/alterViewHelper')(app, options);

	const createViewsScripts = []
		.concat(collection.properties?.views?.properties?.added?.items)
		.filter(Boolean)
		.map(item => Object.values(item.properties)[0])
		.map(view => ({ ...view, ...(view.role || {}) }))
		.filter(view => view.compMod?.created)
		.map(getAddViewScript);

	const deleteViewsScripts = []
		.concat(collection.properties?.views?.properties?.deleted?.items)
		.filter(Boolean)
		.map(item => Object.values(item.properties)[0])
		.map(view => ({ ...view, ...(view.role || {}) }))
		.filter(view => view.compMod?.deleted)
		.map(getDeleteViewScript);

	const modifiedViewsScripts = []
		.concat(collection.properties?.views?.properties?.modified?.items)
		.filter(Boolean)
		.map(item => Object.values(item.properties)[0])
		.map(view => ({ ...view, ...(view.role || {}) }))
		.filter(view => !view.compMod?.created && !view.compMod?.deleted)
		.map(getModifiedViewScript);

	return [...deleteViewsScripts, ...createViewsScripts, ...modifiedViewsScripts].map(script => script.trim());
};

module.exports = {
	getAlterContainersScripts,
	getAlterCollectionsScripts,
	getAlterViewScripts,
};
