const GO_STATEMENT = '\nGO';
const GO_STATEMENT_OPTION_ID = 'useGoStatement';

const needToUseGoStatement = options => {
	const option = (options?.additionalOptions ?? []).find(option => option.id === GO_STATEMENT_OPTION_ID);

	return option?.value;
};

const getTerminator = options => (needToUseGoStatement(options) ? GO_STATEMENT : ';');

module.exports = {
	getTerminator,
};
