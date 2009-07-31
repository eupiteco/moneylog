/*
	moneylog.js
	http://aurelio.net/moneylog
*/

/*********************************************************************
* User Config
* -----------
*
* There is no need to change *anything*, but if you have special
* needs, here is the place to customize this script.
*
*********************************************************************/
// Program interface
var lang = 'pt';                  // 'pt' or 'en' for Portuguese or English
var maxLastMonths = 12;           // Number of months on the last months combo
var initLastMonths = 3;           // Initial value for last months combo
var defaultOverview = false;      // Init in Overview mode?
var defaultLastMonths = false;    // Last months combo inits checked?
var defaultMonthPartials = true;  // Monthly checkbox inits checked?
var defaultFuture = true;         // Show future checkbox inits checked?
var defaultRegex = false;         // Search regex checkbox inits checked?
var defaultNegate = false;        // Search negate checkbox inits checked?
var defaultSearch = '';           // Search for this text on init
var showRowCount = true;          // Show the row numbers at left?
var monthlyRowCount = true;       // The row numbers are reset each month?

// Program structure and files
// Note: dataFile must be UTF-8 (Safari, IE) or ISO-8859-1 (Firefox, Camino)
var oneFile = false;              // Full app is at moneylog.html single file?
var dataFiles = ['moneylog.txt']; // The paths for the data files (requires oneFile=false)

// Data format
var dataFieldSeparator = '\t';
var dataRecordSeparator = /[\n\r]+/;
var dataTagTerminator = '|';
var dataTagSeparator = ',';
var commentChar = '#';   // Must be at line start (column 1)
// Screen Labels
if (lang == 'pt') {
	var labelOverview = 'Relatório Geral:';
	var labelLastMonths = 'Somente Recentes:';
	var labelMonthPartials = 'Mostrar Parciais Mensais';
	var labelFuture = 'Mostrar Lançamentos Futuros';
	var labelNoData = 'Nenhum lançamento.';
	var labelsDetailed = ['Data', 'Valor', 'Tags', 'Descrição'];
	var labelsOverview = ['Período', 'Ganhos', 'Gastos', 'Saldo', 'Acumulado'];
	var labelTotal = 'Total';
	var labelAverage = 'Média';
	var labelMonths = ['mês', 'meses'];
	var labelRegex = ['regex'];
	var labelNegate = ['excluir'];
	var labelMonthly = ['mensal'];
	var labelYearly = ['anual'];
	var centsSeparator = ',';
	var thousandSeparator = '.';
} else {
	var labelOverview = 'Overview:';
	var labelLastMonths = 'Recent Only:';
	var labelMonthPartials = 'Show Monthly Partials';
	var labelFuture = 'Show Future Data';
	var labelNoData = 'No data.';
	var labelsDetailed = ['Date', 'Amount', 'Tags', 'Description'];
	var labelsOverview = ['Period', 'Incoming', 'Expense', 'Partial', 'Balance'];
	var labelTotal = 'Total';
	var labelAverage = 'Average';
	var labelMonths = ['month', 'months'];
	var labelRegex = ['regex'];
	var labelNegate = ['negate'];
	var labelMonthly = ['monthly'];
	var labelYearly = ['yearly'];
	// Screen separators (Inside data both , and . are handled automatically)
	var centsSeparator = '.';
	var thousandSeparator = ',';
}
// End of user Config


var sortColIndex = 0;
var sortColRev = false;
var oldSortColIndex;
var currentDate;
var overviewData = [];

if (!Array.prototype.push) { // IE5...
	Array.prototype.push = function (item) {
		this[this.length] = item;
		return this.length;
	};
}
if (!Number.prototype.toFixed) { // IE5...
	Number.prototype.toFixed = function (n) { // precision hardcoded to 2
		var k = (Math.round(this * 100) / 100).toString();
		k += (k.indexOf('.') == -1) ? '.00' : '00';
		return k.substring(0, k.indexOf('.') + 3);
	};
}
String.prototype.strip = function () {
	return this.replace(/^\s+/, '').replace(/\s+$/, '');
};
Array.prototype.hasItem = function (item) {
	for (var i = 0; i < this.length; i++) {
		if (item == this[i]) { return true; }
	}
	return false;
};
Array.prototype.removePattern = function (patt) {
	var i, cleaned = [];
	for (i = 0; i < this.length; i++) {
		if (this[i] != patt) { cleaned.push(this[i]); }
	}
	return cleaned;
};

function sortCol(index, isOverview) { // if the same, flip reverse state
	sortColRev = (sortColIndex == index) ? sortColRev ^= true : false;
	sortColIndex = index;
	showReport();
}
function sortArray(a, b)  {
	a = a[sortColIndex];
	b = b[sortColIndex];
	try {
		if (sortColIndex == 2) {
			a = a.toLowerCase();
			b = b.toLowerCase();
		}
	} catch (e) { }
	try { // IE6...
		if (a < b) { return -1; }
		else if (a > b) { return 1; }
	} catch (e) { }
	return 0;
}
function sortIgnoreCase(a, b) {
	try {
		a = a.toLowerCase();
		b = b.toLowerCase();
	} catch (e) { }
	try { // IE6...
		if (a < b) { return -1; }
		else if (a > b) { return 1; }
	} catch (e) { }
	return 0;	
}
function setCurrentDate() {
	var z, m, d;
	z = new Date();
	m = z.getMonth() + 1;
	d = z.getDate();
	m = (m < 10) ? '0' + m : m;
	d = (d < 10) ? '0' + d : d;
	currentDate = z.getFullYear() + '-' + m + '-' + d;
}
function getPastMonth(months) {
	var z, m, y;
	z = new Date();
	m = z.getMonth() + 1 - months; // zero based
	y = z.getFullYear();
	if (m < 1) {  // past year
		m = 12 + m;
		y = y - 1;
	}
	m = (m < 10) ? '0' + m : m;
	return y + '-' + m + '-' + '00';
}
function addMonths(yyyymmdd, n) {
	var y, m, d, z;
	yyyymmdd = yyyymmdd.replace(/-/g, '');
	y = parseInt(yyyymmdd.slice(0,4), 10);
	m = parseInt(yyyymmdd.slice(4,6), 10);
	d = yyyymmdd.slice(6,8);
	m = m + n;
	if (m > 12) {
		y = y + Math.floor(m / 12);
		m = m % 12;
		if (m === 0) { // Exception for n=24, n=36, ...
			m = 12;
			y = y - 1;
		}
	}
	m = (m < 10) ? '0' + m : m;
	return y + '-' + m + '-' + d;
}
function prettyFloat(num, noHtml) {
	var myClass = (num < 0) ? 'neg' : 'pos';
	num = num.toFixed(2).replace('.', centsSeparator);
	while (thousandSeparator && num.search(/[0-9]{4}/) > -1) {
		num = num.replace(/([0-9])([0-9]{3})([^0-9])/,
			'$1' + thousandSeparator + '$2$3');
	}
	return (noHtml) ? num : '<span class="' + myClass + '">' + num + '<\/span>';
	// Note: all html *end* tags have the / escaped to pass on validator
}
function populateOverviewRangeCombo() {
	var el;
	el = document.getElementById('overviewrange');
	el.options[0] = new Option(labelMonthly, 'month');
	el.options[1] = new Option(labelYearly, 'year');
}
function populateMonthsCombo() {
	var el, label, i;
	el = document.getElementById('lastmonths');
	label = labelMonths[0];
	for (i = 1; i <= maxLastMonths; i++) {
		if (i > 1) { label = labelMonths[1]; }
		el.options[i - 1] = new Option(i + ' ' + label, i);
	}
	el.selectedIndex = (initLastMonths > 0) ? initLastMonths - 1 : 0;
}
function populateDataFilesCombo() {
	var el, i;
	if (!oneFile) {
		el = document.getElementById('datafiles');
		for (i = 0; i < dataFiles.length; i++) {
			el.options[i] = new Option(dataFiles[i]);
		}
	}
}
function getTotalsRow(total, monthTotal, monthNeg, monthPos) {
	var partial, theRow;
	if (monthTotal) {
		partial = [];
		partial.push('<table class="monthsubtotal number" align="right"><tr>');
		partial.push('<td class="mini"> +');
		partial.push(prettyFloat(monthPos, true) + '<br>');
		partial.push(prettyFloat(monthNeg, true) + '<\/td>');
		partial.push('<td>' + prettyFloat(monthTotal) + '<\/td>');
		partial.push('<\/tr><\/table>');
		partial = partial.join('');
	} else {
		partial = '';
	}
	theRow = '<tr class="monthtotal">';
	if (showRowCount) {
		theRow += '<td class="row-count"><\/td>';
	}
	theRow += '<td><\/td>';
	theRow += '<td class="number">' + prettyFloat(total) + '<\/td>';
	theRow += '<td colspan="2">' + partial + '<\/td><\/tr>';
	return theRow;
}
function getOverviewRow(theMonth, monthPos, monthNeg, monthTotal, theTotal, rowCount) {
	var theRow = [];
	theRow.push((theMonth <= currentDate.slice(0, 7)) ? '<tr>' : '<tr class="future">');
	if (showRowCount) {
		theRow.push('<td class="row-count">' + rowCount + '<\/td>');
	}
	theRow.push('<td>' + theMonth + '<\/td>');
	theRow.push('<td class="number">' + prettyFloat(monthPos)  + '<\/td>');
	theRow.push('<td class="number">' + prettyFloat(monthNeg)  + '<\/td>');
	theRow.push('<td class="number">' + prettyFloat(monthTotal) + '<\/td>');
	theRow.push('<td class="number">' + prettyFloat(theTotal)  + '<\/td>');
	theRow.push('<\/tr>');
	return theRow.join('\n');
}
function getOverviewTotalsRow(label, n1, n2, n3) {
	var theRow = [];
	theRow.push('<tr class="total">');
	if (showRowCount) {
		theRow.push('<td class="row-count"><\/td>');
	}
	theRow.push('<td class="rowlabel">' + label + '<\/td>');
	theRow.push('<td class="number">' + prettyFloat(n1)  + '<\/td>');
	theRow.push('<td class="number">' + prettyFloat(n2)  + '<\/td>');
	theRow.push('<td class="number">' + prettyFloat(n3) + '<\/td>');
	theRow.push('<td><\/td>');
	theRow.push('<\/tr>');
	return theRow.join('\n');
}
function toggleOverview() {
	// When active, hide some controls from the toolbar and also the tags
	if (document.getElementById('optoverview').checked === true) {
		document.getElementById('filterbox'      ).style.visibility = 'hidden';
		document.getElementById('optmonthly'     ).style.visibility = 'hidden';
		document.getElementById('optmonthlylabel').style.visibility = 'hidden';
		document.getElementById('tagsArea'       ).style.display = 'none';
		oldSortColIndex = sortColIndex; // save state
		sortColIndex = 0; // Default by date
	} else {
		document.getElementById('filterbox'      ).style.visibility = '';
		document.getElementById('optmonthly'     ).style.visibility = '';
		document.getElementById('optmonthlylabel').style.visibility = '';
		document.getElementById('tagsArea'       ).style.display = 'block';
		sortColIndex = oldSortColIndex;
		overviewData = [];
	}
	showReport();
}
function overviewRangeChanged() {
	// Automatic switch to overview mode when changing range
	if (!document.getElementById('optoverview').checked) {
		document.getElementById('optoverview').checked = true;
		toggleOverview();

	// Already in overview mode, just update the report
	} else {
		overviewData = [];
		showReport();
	}
}
function toggleLastMonths() {
	overviewData = [];
	showReport();
}
function lastMonthsChanged() {
	document.getElementById('optlastmonths').checked = true;
	overviewData = [];
	showReport();
}
function toggleFuture() {
	overviewData = [];
	showReport();
}
function toggleMonthly() {
	if (document.getElementById('optmonthly').checked === true) {
		sortColIndex = 0;
		sortColRev = false;
	}
	showReport();
}
function toggleHelp() {
	var el = document.getElementById('help');
	el.style.display = (el.style.display == 'block') ? 'none' : 'block';
}
function loadDataFile(filePath) {
	if (!filePath) { return; }
	document.getElementById("dataFrame").src = filePath;
	overviewData = [];
	setTimeout("showReport()", 100);
	// The browser won't load the iframe contents unless we schedule it (strange...)
}
function reloadData() {
	loadDataFile(document.getElementById('datafiles').value);
}
function readData() {
	var i, j, temp, isRegex, isNegated, filter, filterPassed, firstDate, showFuture, theData, rawData, rowDate, rowAmount, rowText, rowTagsDescription, rowTags, rowDescription, recurrentAmount, recValue, recTimes, recOperator;

	isRegex = false;
	isNegated = false;
	filter = '';
	firstDate = 0;
	theData = [];

	// Read raw data from #data block or from external dataFile (iframe)
	if (oneFile) {
		rawData = document.getElementById('data').innerHTML;
		
	} else {
		rawData = frames[0].document.getElementsByTagName('pre')[0].innerHTML;
	}

	rawData = rawData.split(dataRecordSeparator);
	
	if (document.getElementById('optlastmonths').checked) {
		firstDate = getPastMonth(document.getElementById('lastmonths').value - 1);
	}
	
	// Show future works for both views
	showFuture = document.getElementById('optfuture').checked;
	
	// Get filters data for the detailed report
	if (!document.getElementById('optoverview').checked) {
		filter = document.getElementById('filter').value;
		isRegex = document.getElementById('optregex').checked;
		isNegated = document.getElementById('optnegate').checked;
	}
	
	// Prepare filter contents as /regex/ or string, always ignore case
	if (filter) {
		if (isRegex) {
			filter = eval('/' + filter.replace('/', '\\/') + '/i');
		} else {
			filter = filter.toLowerCase();
		}
	}

	// Scan data rows
	for (i = 0; i < rawData.length; i++) {

		// Skip commented rows
		if (rawData[i].indexOf(commentChar) === 0) { continue; }
		// Skip rows with no separator
		if (rawData[i].indexOf(dataFieldSeparator) == -1) { continue; }
		
		// Filter firewall - Will this line pass it?
		if (filter) {
			if (isRegex) {
				filterPassed = filter.test(rawData[i]);
			} else {
				filterPassed = (rawData[i].toLowerCase().indexOf(filter) != -1);
			}
			if ((!filterPassed && !isNegated) || (filterPassed && isNegated)) { continue; }
		}

		// Parse row data
		temp = rawData[i].split(dataFieldSeparator);
		while (temp.length < 3) { temp.push(''); } // Force 3 items
		rowDate   = temp[0];
		rowAmount = temp[1] || '0';
		rowText   = temp[2].strip();
		
		// Normalize Date
		rowDate = rowDate.replace(/[^0-9\-]/, '') || '-';
		
		// Normalize Value (force '.' as cents separator)
		rowAmount = rowAmount.replace(/[.,]([0-9][0-9]) *([\/*]|$)/, '@$1$2'
			).replace(/[^0-9@+\/*\-]/g, ''
			).replace('@', '.');

		// A value of -100/10 means I've spent 100 and will pay it in 10x
		// A value of -100*10 means I'll spent 100/month in the next 10 months
		// This idea came from myMoneyLog. Thanks Nishimura!
		//
		// Compose each payment row, changing: date, value and description
		// 2009-12-25  -90/3  Foo        |    2009-12-25  -90*3  Foo
		// turns to                      |    turns to 
		// 2009-12-25  -30    Foo 1/3    |    2009-12-25  -90    Foo 1/3
		// 2010-01-25  -30    Foo 2/3    |    2010-01-25  -90    Foo 2/3
		// 2010-02-25  -30    Foo 3/3    |    2010-02-25  -90    Foo 3/3
		//
		// XXX It doesn't fix end-of-month day. Uses 2009-02-31 instead 2009-02-28. But it's OK.
		//
		recurrentAmount = rowAmount.match(/^([+\-]?[0-9.]+)([\/*])([0-9]+)$/);
		if (recurrentAmount) {
			recValue = recurrentAmount[1];
			recTimes = parseInt(recurrentAmount[3], 10);
			recOperator = recurrentAmount[2];
			
			if (recOperator == '/') {
				recValue = (recValue / recTimes).toFixed(2);
			}

			// Compose and append each new row
			for (j = 1; j <= recTimes; j++) {
				rawData.push([
					addMonths(rowDate, j - 1),
					recValue,
					rowText + ' ' + j + '/' + recTimes
				].join('\t'));
			}
			
			// Ignore the original recurring row
			continue;
		}
		rowAmount = parseFloat(rowAmount); // str2float
		
		// Ignore dates older than "last N months" option (if checked)
		if (rowDate < firstDate) { continue; }

		// Ignore future dates
		if (!showFuture && rowDate > currentDate) { continue; }

		// Normalize desc/tags
		if (rowText.indexOf(dataTagTerminator) != -1) {
			// Get tags
			// FIXME: Can't handle more than one separator
			rowTagsDescription = rowText.split(dataTagTerminator);
			rowTags        = rowTagsDescription[0].split(dataTagSeparator);
			rowDescription = rowTagsDescription[1].strip();
			
			// Strip all tags
			for (j = 0; j < rowTags.length; j++) {
				rowTags[j] = rowTags[j].strip();
			}
			rowTags = rowTags.removePattern('');
		} else {
			rowTags = [];
			rowDescription = rowText || '&nbsp;';
		}
		
		// Save the parsed data
		theData.push([rowDate, rowAmount, rowTags, rowDescription]);
	}
	
	return theData;
}
function applyTags(theData) {
	// This function composes the full tag menu and
	// also filters theData if some tag is selected
	
	var i, j, rowTags, thisTag, tagMatched, tagName, tagId, checked, tagCount, tagElement, tagsMenu, selectedTags, filteredData, tagMultiAll;
	
	tagsMenu = [];
	selectedTags = [];
	filteredData = [];
	
	// Get multiple selection mode (true=AND, false=OR)
	tagMultiAll = document.getElementById('tagMultiAllCheck').checked;
	
	// Get currently selected tags (from interface)
	try {
		tagCount = document.getElementById('tagCount').value;
		for (i = 1; i <= tagCount; i++) {
			tagElement = document.getElementById('tag_' + i);
			if (tagElement && tagElement.checked) {
				selectedTags.push(tagElement.value);
			}
		}
	} catch (e) { }
	
	// Filter data to match current tags
	for (i = 0; i < theData.length; i++) {
		
		// Array order: date, amount, tags, desc
		rowTags = theData[i][2];
		
		// Populate tags array with UNIQUE row tags
		for (j = 0; j < rowTags.length; j++) {
			if (!tagsMenu.hasItem(rowTags[j])) {
				tagsMenu.push(rowTags[j]);
			}
		}

		// Tag Filter is active. This line matches it?
		if (selectedTags.length > 0) {
		
			for (j = 0; j < selectedTags.length; j++) {

				thisTag = selectedTags[j];
				tagMatched = (rowTags.hasItem(thisTag) ||
					(thisTag == ' ' && rowTags.length === 0));
					// Tip: space means no tag
				
				if (tagMatched && (!tagMultiAll)) { break; } // OR
				if (!tagMatched && (tagMultiAll)) { break; } // AND
			}
			if (tagMatched) {
				filteredData.push(theData[i]);
			}
		}
	}
	
	// Make sure the menu has all the selected tags
	for (i = 0; i < selectedTags.length; i++) {
		if (!tagsMenu.hasItem(selectedTags[i]) && selectedTags[i] != ' ') {
			tagsMenu.push(selectedTags[i]);
		}
	}

	// Compose the tags menu HTML code (if we have at least one tag)
	if (tagsMenu.length > 0) {
		
		// Sorted tags are nice
		tagsMenu.sort(sortIgnoreCase);

		// Add a last ' ' item to match the rows with no tag
		tagsMenu.push(' ');
		
		// Save the total tag count
		document.getElementById('tagCount').value = tagsMenu.length;
		
		// Add one checkbox for each tag
		for (i = 0; i < tagsMenu.length; i++) {
			tagName = tagsMenu[i];
			tagId = 'tag_' + (i + 1);
			
			// Selected tags remain selected
			checked = selectedTags.hasItem(tagName) ? 'checked="checked"' : '';
			
			// The ugly code (but better than DOM-walking nightmares)
			tagsMenu[i] = '<input type="checkbox" class="trigger" onClick="showReport()" ' +
				checked + ' id="' + tagId + '" value="' + tagName + '">' +
				'<span class="trigger" onClick="document.getElementById(\'' + tagId + '\').click()">&nbsp;' + tagName + '<\/span>';
		}

		// One tag per line
		tagsMenu = tagsMenu.join('<br>\n');
	}
	
	// Save the tags menu (or make it empty)
	document.getElementById('tagList').innerHTML = tagsMenu;
	
	// Show the tags menu if we have at least one tag
	document.getElementById('tagsArea').style.display = (
		tagsMenu.length > 0) ? 'block' : 'none';

	// The '+' checkbox is only shown if we have multiple selected tags
	document.getElementById('tagMultiAll').style.display = (
		selectedTags.length > 1) ? 'inline' : 'none';

	// Tag filter was active?
	if (selectedTags.length > 0) {
		return filteredData;
	} else {
		return theData;
	}
}
function showOverview() {
	var i, z, len, rowDate, rowAmount, theData, thead, results, grandTotal, dateSize, rangeType, rangeDate, rangeTotal, rangePos, rangeNeg, sumPos, sumNeg, sumTotal, currSortIndex;

	results = [];
	grandTotal = rangeTotal = rangePos = rangeNeg = sumPos = sumNeg = sumTotal = 0;
	currSortIndex = sortColIndex;

	// Table headings
	thead = '<th onClick="sortCol(0, true)">' + labelsOverview[0] + '<\/th>';
	thead += '<th onClick="sortCol(1, true)">' + labelsOverview[1] + '<\/th>';
	thead += '<th onClick="sortCol(2, true)">' + labelsOverview[2] + '<\/th>';
	thead += '<th onClick="sortCol(3, true)">' + labelsOverview[3] + '<\/th>';
	thead += '<th onClick="sortCol(4, true)">' + labelsOverview[4] + '<\/th>';
	if (showRowCount) {
		thead = '<th class="row-count"><\/th>' + thead;
	}

	if (!overviewData.length) { // Data not cached
		theData = readData();
		sortColIndex = 0; // Always scan by date order
		theData.sort(sortArray);
	}

	if (overviewData.length || theData.length) {
		results.push('<table class="overview">');
		results.push('<tr>' + thead + '<\/tr>');

		// The cache is empty. Scan and calculate everything.
		if (!overviewData.length) {
			
			rangeType = document.getElementById('overviewrange').value; // month|year
						
			for (i = 0; i < theData.length; i++) {
				rowDate        = theData[i][0];
				rowAmount      = theData[i][1];
				/* rowTags        = theData[i][2]; */
				/* rowDescription = theData[i][3]; */

				// rowDate.slice() size, to extract 2000 or 2000-01
				dateSize = (rangeType == 'year') ? 4 : 7;
				
				// First row, just save the month/year date
				if (i === 0) {
					rangeDate = rowDate.slice(0, dateSize);
				}

				// Other rows, detect if this is a new month/year
				if (i > 0 &&
					rowDate.slice(0, dateSize) !=
					theData[i - 1][0].slice(0, dateSize)) {
					
					// Send old month/year totals to the report
					overviewData.push([rangeDate, rangePos, rangeNeg, rangeTotal, grandTotal]);	
					// Reset totals
					rangeTotal = rangePos = rangeNeg = 0;
					// Save new month/year date
					rangeDate = rowDate.slice(0, dateSize);
				}
				
				// Common processing for all rows: update totals
				grandTotal += rowAmount;
				rangeTotal += rowAmount;
				if (rowAmount < 0) {
					rangeNeg += rowAmount;
				} else {
					rangePos += rowAmount;
				}
			}		
			// No more rows. Send the last range totals to the report.
			overviewData.push([rangeDate, rangePos, rangeNeg, rangeTotal, grandTotal]);
		}
		// End of cache filling
		
		//// Report data is OK inside overviewData array
		//// Now we must compose the report table
		
		// Perform the user-selected sorting column and order
		sortColIndex = currSortIndex;
		overviewData.sort(sortArray);
		if (sortColRev) {
			overviewData.reverse();
		}
		
		// Array2Html
		for (i = 0; i < overviewData.length; i++) {
			// Calculate overall totals
			z = overviewData[i];
			sumPos   += z[1];
			sumNeg   += z[2];
			sumTotal += z[3];
			// Save this row to the report table
			results.push(getOverviewRow(z[0], z[1], z[2], z[3], z[4], i + 1));
		}
		
		// Compose the final average row
		len = overviewData.length;
		results.push(getOverviewTotalsRow(labelTotal, sumPos, sumNeg, sumPos + sumNeg));
		results.push(getOverviewTotalsRow(labelAverage, sumPos / len, sumNeg / len, sumTotal / len));
		
		// And we're done
		results.push('<\/table>');
		results = results.join('\n');
	} else {
		results = labelNoData;
	}
	document.getElementById('report').innerHTML = results;
}

function showDetailed() {
	var thead, i, rowDate, rowAmount, rowTags, rowDescription, theTotal, monthTotal, monthPos, monthNeg, rowCount, results, monthPartials, theData;
	
	theTotal = monthTotal = monthPos = monthNeg = rowCount = 0;
	results = [];
	
	monthPartials = document.getElementById('optmonthly');
	theData = applyTags(readData());
	
	if (theData.length > 0) {

		// Data sorting procedures
		if (sortColIndex !== 0 || sortColRev) {
			monthPartials.checked = false;
		}
		theData.sort(sortArray);
		if (sortColRev) { theData.reverse(); }

		// Compose table headings
		thead = '<th onClick="sortCol(0)">' + labelsDetailed[0] + '<\/th>';
		thead += '<th onClick="sortCol(1)">' + labelsDetailed[1] + '<\/th>';
		thead += '<th onClick="sortCol(2)" class="tags">' + labelsDetailed[2] + '<\/th>';
		thead += '<th onClick="sortCol(3)">' + labelsDetailed[3] + '<\/th>';
		if (showRowCount) {
			thead = '<th class="row-count"><\/th>' + thead;
		}
		results.push('<table>');
		results.push('<tr>' + thead + '<\/tr>');

		// Compose table rows
		for (i = 0; i < theData.length; i++) {
			
			rowDate        = theData[i][0];
			rowAmount      = theData[i][1];
			rowTags        = theData[i][2];
			rowDescription = theData[i][3];
			rowCount      += 1;
			
			// This row starts a new month? Must we show the partials?
			if (monthPartials.checked && i > 0 &&
				rowDate.slice(0, 7) !=
				theData[i - 1][0].slice(0, 7)) {
				results.push(getTotalsRow(theTotal, monthTotal, monthNeg, monthPos));
				// Partials row shown, reset month totals
				monthTotal = 0;
				monthPos = 0;
				monthNeg = 0;
				if (monthlyRowCount) {
					rowCount = 1;
				}
			}
			
			// This row is in the future?
			if (rowDate <= currentDate) {
				results.push('<tr>');
			} else {
				results.push('<tr class="future">');
			}
			
			if (showRowCount) {
				results.push('<td class="row-count">' + (rowCount) + '<\/td>');
			}
			
			results.push('<td class="date">'   + rowDate                + '<\/td>');
			results.push('<td class="number">' + prettyFloat(rowAmount) + '<\/td>');
			results.push('<td class="tags">'   + rowTags.join(', ')     + '<\/td>');
			results.push('<td>'                + rowDescription         + '<\/td>');
			results.push('<\/tr>');
				
			// Update totals
			theTotal += rowAmount;
			monthTotal += rowAmount;
			if (rowAmount < 0) {
				monthNeg += rowAmount;
			} else {
				monthPos += rowAmount;
			}
		}
		
		// Should we show the full month partials at the last row?
		if (monthPartials.checked) {
			results.push(getTotalsRow(theTotal, monthTotal, monthNeg, monthPos));
		} else {
			results.push(getTotalsRow(theTotal));
		}
		
		results.push('<\/table>');
		results = results.join('\n');

		// Real dirty hack to insert totals row at the table beginning (UGLY!)
		/* results = results.replace('<\/th><\/tr>', '<\/th><\/tr>' + getTotalsRow(theTotal)); */
	}
	else {
		results = labelNoData;
	}
	document.getElementById('report').innerHTML = results;
}

function showReport() {
	if (document.getElementById('optoverview').checked) {
		showOverview();
	} else {
		showDetailed();
	}
}
function init() {
	var sitelink;

	setCurrentDate();
	populateMonthsCombo();
	populateDataFilesCombo();
	populateOverviewRangeCombo();
	
	// Just show files combo when there are 2 or more
	if (oneFile || dataFiles.length < 2) {
		document.getElementById('datafiles').style.display = 'none';
	}
	
	// Hide Reload button in oneFile mode. No iframe, so we can't reload.
	if (oneFile) {
		document.getElementById('reload').style.visibility = 'hidden';
	}
	
	// Lang-specific info
	document.getElementById('optoverviewlabel'  ).innerHTML = labelOverview;
	document.getElementById('optlastmonthslabel').innerHTML = labelLastMonths;
	document.getElementById('optmonthlylabel'   ).innerHTML = labelMonthPartials;
	document.getElementById('optfuturelabel'    ).innerHTML = labelFuture;
	document.getElementById('optregexlabel'     ).innerHTML = labelRegex;
	document.getElementById('optnegatelabel'    ).innerHTML = labelNegate;
	
	if (lang == 'pt') {
		sitelink = document.getElementById('sitelink');
		sitelink.href = 'http://aurelio.net/moneylog';
		sitelink.title = 'Uma página. Um programa.';
		document.getElementById('help-en').style.display = 'none';
	} else {
		document.getElementById('help-pt').style.display = 'none';
	}
	
	// Apply user defaults
	if (defaultOverview)      { document.getElementById('optoverview'  ).click(); }
	if (defaultLastMonths)    { document.getElementById('optlastmonths').click(); }
	if (defaultMonthPartials) { document.getElementById('optmonthly'   ).click(); }
	if (defaultFuture)        { document.getElementById('optfuture'    ).click(); }
	if (defaultRegex)         { document.getElementById('optregex'     ).click(); }
	if (defaultNegate)        { document.getElementById('optnegate'    ).click(); }
	document.getElementById('filter').value = defaultSearch;

	// Load data file
	if (!oneFile) {
		loadDataFile(dataFiles[0]);
	} else {
		showReport();
	}

	// document.getElementById('filter').focus();
}
window.onload = init;
