const getAllDatabasesTablesInfo = async (client, includeViews = true) => {
	const viewJoin = includeViews ? `LEFT JOIN '+ quotename(name) + '.sys.views v on v.schema_id = t.schema_id` : '';
	const orderByView = includeViews ? `, view_name` : '';
	const viewName = includeViews ? `, v.name as view_name` : '';
	return await client.request().query(`
			declare @sql nvarchar(max);
			select @sql = 
				(select ' UNION ALL
					SELECT ' +  + quotename(name,'''') + ' as database_name,
								s.name as schema_name,
								t.name COLLATE DATABASE_DEFAULT as table_name
								${viewName}
								FROM '+ quotename(name) + '.sys.tables t
								LEFT JOIN '+ quotename(name) + '.sys.schemas s on s.schema_id = t.schema_id
								${viewJoin}
								WHERE t.is_ms_shipped = 0
								'
					from sys.databases
					where state=0
					order by [name] for xml path(''), type).value('.', 'nvarchar(max)');

			set @sql = stuff(@sql, 1, 12, '') + ' order by database_name,
															table_name
															${orderByView}';

			execute (@sql);
		`);
};

module.exports = getAllDatabasesTablesInfo;
