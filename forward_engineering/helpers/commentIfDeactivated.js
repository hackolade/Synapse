const BEFORE_DEACTIVATED_STATEMENT = '-- ';

const commentIfDeactivated = (statement, data, isPartOfLine) => {
	if (data?.hasOwnProperty('isActivated') && !data.isActivated) {
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

const queryIsDeactivated = (query, statement) => {
	return query.includes(statement) && query.startsWith(BEFORE_DEACTIVATED_STATEMENT);
};

const createRegForMultyLineComment = terminator => 
	new RegExp(`\\/\\*[\\s\\S]*?${terminator}\n?\\s\\*\\/`, 'gi');

const filterDeactivatedQuery = (query, terminator) => {
	const regExp = createRegForMultyLineComment(terminator);
	return query.replace(regExp, '');
};

module.exports = { 
	commentIfDeactivated,
	queryIsDeactivated,
	filterDeactivatedQuery,
};
