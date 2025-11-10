const BEFORE_DEACTIVATED_STATEMENT = '-- ';
const REG_FOR_MULTILINE_COMMENT = /(\n\/\*\n[\s\S]*?\n\s\*\/\n)|((\n\/\*\n[\s\S]*?\n\s\*\/)$)/gi;

const commentIfDeactivated = (statement, data, isPartOfLine) => {
	if (data.isActivated === false && statement) {
		if (isPartOfLine) {
			return '/* ' + statement + ' */';
		} else if (statement.includes('\n')) {
			return '/*\n' + statement + ' */\n';
		} else {
			return BEFORE_DEACTIVATED_STATEMENT + statement;
		}
	}
	return statement;
};

const queryIsDeactivated = (query = '') => {
	return query.startsWith(BEFORE_DEACTIVATED_STATEMENT);
};

const filterDeactivatedQuery = query => query.replaceAll(REG_FOR_MULTILINE_COMMENT, '');

module.exports = {
	commentIfDeactivated,
	queryIsDeactivated,
	filterDeactivatedQuery,
};
