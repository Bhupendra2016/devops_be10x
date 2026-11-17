const STORAGE_KEY = "pennywise-finance-v1";

const categories = [
  { name: "Food & dining", icon: "☕", color: "#639772", type: "expense", budget: 1200000 },
  { name: "Housing", icon: "⌂", color: "#e7af75", type: "expense", budget: 2500000 },
  { name: "Transport", icon: "↗", color: "#829eb3", type: "expense", budget: 500000 },
  { name: "Shopping", icon: "✳", color: "#a88eb8", type: "expense", budget: 800000 },
  { name: "Health", icon: "✚", color: "#d17c72", type: "expense", budget: 500000 },
  { name: "Bills", icon: "▤", color: "#81a6a0", type: "expense", budget: 600000 },
  { name: "Entertainment", icon: "♫", color: "#d59b67", type: "expense", budget: 500000 },
  { name: "Salary", icon: "↙", color: "#6d9a77", type: "income" },
  { name: "Freelance", icon: "✎", color: "#7d9bb4", type: "income" },
  { name: "Other", icon: "•", color: "#9ba9a1", type: "expense" }
];

const accountNames = ["Everyday account", "Cash wallet", "Credit card"];
const pad = (value) => String(value).padStart(2, "0");
const dateString = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const monthKey = (date) => date.slice(0, 7);
const today = new Date();
const todayString = dateString(today);
const currentMonth = monthKey(todayString);
const monthOffset = (offset, day) => {
  const date = new Date(today.getFullYear(), today.getMonth() + offset, Math.min(day || 10, 28));
  return dateString(date);
};
const makeSeedTransactions = () => {
  const rows = [
    [0, 8500000, "income", "Salary", "Monthly salary", "Everyday account", 1],
    [0, 128000, "expense", "Food & dining", "Brunch at Blue Tokai", "Credit card", 3],
    [0, 2450000, "expense", "Housing", "Home rent", "Everyday account", 5],
    [0, 32000, "expense", "Transport", "Metro card top-up", "Cash wallet", 6],
    [0, 76400, "expense", "Shopping", "A few little things", "Credit card", 8],
    [0, 18900, "expense", "Food & dining", "Groceries", "Everyday account", 9],
    [0, 52000, "expense", "Bills", "Internet & mobile", "Everyday account", 11],
    [0, 42000, "expense", "Health", "Pharmacy", "Credit card", 12],
    [0, 28000, "expense", "Entertainment", "Movie night", "Credit card", 14],
    [-1, 8500000, "income", "Salary", "Monthly salary", "Everyday account", 1],
    [-1, 196000, "expense", "Food & dining", "Groceries & coffee", "Everyday account", 4],
    [-1, 2450000, "expense", "Housing", "Home rent", "Everyday account", 5],
    [-1, 89000, "expense", "Transport", "Cab rides", "Credit card", 9],
    [-1, 72000, "expense", "Shopping", "Home bits", "Credit card", 16],
    [-2, 8500000, "income", "Salary", "Monthly salary", "Everyday account", 1],
    [-2, 220000, "expense", "Food & dining", "Dinner with friends", "Credit card", 7],
    [-2, 2450000, "expense", "Housing", "Home rent", "Everyday account", 5],
    [-2, 65000, "expense", "Transport", "Metro & cabs", "Cash wallet", 12],
    [-3, 8500000, "income", "Salary", "Monthly salary", "Everyday account", 1],
    [-3, 163000, "expense", "Food & dining", "Groceries", "Everyday account", 8],
    [-3, 2450000, "expense", "Housing", "Home rent", "Everyday account", 5],
    [-4, 8500000, "income", "Salary", "Monthly salary", "Everyday account", 1],
    [-4, 198000, "expense", "Food & dining", "Lunches & groceries", "Everyday account", 6],
    [-4, 2450000, "expense", "Housing", "Home rent", "Everyday account", 5]
  ];
  return rows.map(([offset, amount, type, category, note, account, day], index) => ({
    id: `seed-${index}`,
    date: monthOffset(offset, day),
    amount,
    type,
    category,
    note,
    account
  }));
};

const savedState = localStorage.getItem(STORAGE_KEY);
const state = savedState ? JSON.parse(savedState) : { transactions: makeSeedTransactions(), budgets: {} };
if (!Array.isArray(state.transactions)) state.transactions = makeSeedTransactions();
if (!state.budgets || typeof state.budgets !== "object") state.budgets = {};
let activeMonth = currentMonth;
let editingId = null;
let importRows = [];
let importHeaders = [];
let toastTimer;

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
const safe = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
})[char]);
const money = (minor, compact = false) => {
  const amount = (minor || 0) / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
    notation: compact && amount >= 100000 ? "compact" : "standard"
  }).format(amount);
};
const categoryFor = (name) => categories.find((item) => item.name === name) || categories[categories.length - 1];
const formatDate = (value, options = { day: "numeric", month: "short" }) =>
  new Intl.DateTimeFormat("en-IN", options).format(new Date(`${value}T12:00:00`));
const labelMonth = (value, options = { month: "long", year: "numeric" }) =>
  new Intl.DateTimeFormat("en-IN", options).format(new Date(`${value}-15T12:00:00`));
const persist = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
const transactionsForMonth = (month) => state.transactions.filter((item) => monthKey(item.date) === month);
const totalsFor = (transactions) => transactions.reduce((totals, item) => {
  totals[item.type] += item.amount;
  return totals;
}, { income: 0, expense: 0 });

function showToast(message, actionLabel, action) {
  const region = $("#toastRegion");
  clearTimeout(toastTimer);
  region.innerHTML = `<div class="toast"><span>${safe(message)}</span>${actionLabel ? `<button type="button" id="toastAction">${safe(actionLabel)}</button>` : ""}</div>`;
  if (actionLabel && action) $("#toastAction").addEventListener("click", () => {
    action();
    region.innerHTML = "";
  }, { once: true });
  toastTimer = setTimeout(() => { region.innerHTML = ""; }, 4200);
}

function setMonthOptions(select) {
  select.innerHTML = Array.from({ length: 12 }, (_, index) => {
    const date = new Date(today.getFullYear(), today.getMonth() - index, 1);
    const key = `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
    return `<option value="${key}">${safe(labelMonth(key))}</option>`;
  }).join("");
  select.value = activeMonth;
}

function renderSummary() {
  const transactions = transactionsForMonth(activeMonth);
  const totals = totalsFor(transactions);
  const saved = totals.income - totals.expense;
  const savingsRate = totals.income ? Math.round((saved / totals.income) * 100) : 0;
  const prevDate = new Date(`${activeMonth}-15T12:00:00`);
  prevDate.setMonth(prevDate.getMonth() - 1);
  const previous = totalsFor(transactionsForMonth(`${prevDate.getFullYear()}-${pad(prevDate.getMonth() + 1)}`));
  const expenseChange = previous.expense ? Math.round(((totals.expense - previous.expense) / previous.expense) * 100) : null;
  const totalBalance = state.transactions.reduce((sum, item) => sum + (item.type === "income" ? item.amount : -item.amount), 4125000);
  const cards = [
    { title: "Total balance", value: money(totalBalance, true), icon: "◉", note: "Across your accounts", tone: "" },
    { title: "Income this month", value: money(totals.income, true), icon: "↙", note: `${transactions.filter((item) => item.type === "income").length} deposits so far`, tone: "positive" },
    { title: "Spent this month", value: money(totals.expense, true), icon: "↗", note: expenseChange === null ? "Your spending, at a glance" : `${Math.abs(expenseChange)}% ${expenseChange > 0 ? "more" : "less"} than last month`, tone: expenseChange > 0 ? "" : "positive" },
    { title: "Net savings", value: money(saved, true), icon: "✳", note: `${savingsRate}% of income saved`, tone: "positive" }
  ];
  $("#summaryCards").innerHTML = cards.map((card) => `<article class="summary-card">
    <div class="summary-head"><span>${card.title}</span><span class="summary-icon">${card.icon}</span></div>
    <div class="summary-value">${card.value}</div><div class="summary-note ${card.tone}">${card.note}</div>
  </article>`).join("");
}

function renderSpending() {
  const expenses = transactionsForMonth(activeMonth).filter((item) => item.type === "expense");
  const totals = new Map();
  expenses.forEach((item) => totals.set(item.category, (totals.get(item.category) || 0) + item.amount));
  const allCategories = Array.from(totals.entries()).sort((a, b) => b[1] - a[1]);
  const ordered = allCategories.slice(0, 5);
  const remainder = allCategories.slice(5).reduce((sum, item) => sum + item[1], 0);
  if (remainder) ordered.push(["Other", remainder]);
  const total = expenses.reduce((sum, item) => sum + item.amount, 0);
  let running = 0;
  const stops = ordered.map(([name, value]) => {
    const start = running;
    running += total ? value / total * 100 : 0;
    return `${categoryFor(name).color} ${start}% ${running}%`;
  });
  if (!stops.length) stops.push("#edf1ed 0% 100%");
  $("#donutChart").style.background = `conic-gradient(${stops.join(", ")})`;
  $("#donutChart").setAttribute("aria-label", `Spending by category, ${money(total)}`);
  $("#donutCenter").innerHTML = `<strong>${money(total, true)}</strong><small>total spent</small>`;
  $("#categoryLegend").innerHTML = ordered.length
    ? ordered.map(([name, value]) => `<div class="legend-item"><i style="background:${categoryFor(name).color}"></i><span>${safe(name)}</span><strong>${money(value, true)}</strong></div>`).join("")
    : `<div class="empty-state">No spending to show yet.</div>`;
}

function renderTrend() {
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(`${activeMonth}-15T12:00:00`);
    date.setMonth(date.getMonth() - (5 - index));
    const key = `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
    return { key, label: labelMonth(key, { month: "short" }), ...totalsFor(transactionsForMonth(key)) };
  });
  const max = Math.max(...months.flatMap((item) => [item.income, item.expense]), 1);
  const plotTop = 13, plotBottom = 119, chartHeight = plotBottom - plotTop;
  const bars = months.map((item, index) => {
    const groupX = 29 + index * 78;
    const incomeHeight = Math.max(2, item.income / max * chartHeight);
    const expenseHeight = Math.max(2, item.expense / max * chartHeight);
    return `<rect x="${groupX}" y="${plotBottom - incomeHeight}" width="13" height="${incomeHeight}" rx="4" fill="#6c9b78"><title>${safe(item.label)} income ${money(item.income)}</title></rect>
      <rect x="${groupX + 17}" y="${plotBottom - expenseHeight}" width="13" height="${expenseHeight}" rx="4" fill="#e1ad79"><title>${safe(item.label)} expenses ${money(item.expense)}</title></rect>
      <text x="${groupX + 15}" y="143" text-anchor="middle" fill="#9aa69f" font-size="9">${safe(item.label)}</text>`;
  }).join("");
  $("#trendChart").innerHTML = `<svg viewBox="0 0 500 153" preserveAspectRatio="none" aria-hidden="true">
    <line x1="10" y1="119" x2="490" y2="119" stroke="#edf0ed" stroke-width="1"/>
    <line x1="10" y1="66" x2="490" y2="66" stroke="#f1f3f1" stroke-width="1" stroke-dasharray="3 4"/>
    ${bars}</svg>`;
}

function budgetLimit(category, month = activeMonth) {
  return state.budgets[`${month}:${category.name}`] ?? category.budget ?? 0;
}
function budgetUsed(categoryName, month = activeMonth) {
  return transactionsForMonth(month)
    .filter((item) => item.type === "expense" && item.category === categoryName)
    .reduce((sum, item) => sum + item.amount, 0);
}
function budgetMarkup(category) {
  const limit = budgetLimit(category);
  const used = budgetUsed(category.name);
  const percent = limit ? Math.round(used / limit * 100) : 0;
  const stateClass = percent > 100 ? "over" : percent >= 80 ? "warning" : "";
  const status = percent > 100 ? "Over budget" : percent >= 80 ? "Getting close" : "On track";
  return `<div class="budget-item">
    <div class="budget-item-head"><span class="budget-name"><span class="category-emoji">${category.icon}</span>${safe(category.name)}<span class="budget-status ${stateClass}">${status}</span></span><span class="budget-amount"><strong>${money(used, true)}</strong> / ${money(limit, true)}</span></div>
    <div class="progress-track" role="progressbar" aria-label="${safe(category.name)} budget used" aria-valuenow="${Math.min(percent, 100)}" aria-valuemin="0" aria-valuemax="100"><div class="progress-fill ${stateClass}" style="width:${Math.min(percent, 100)}%"></div></div>
    <div class="budget-caption"><span>${percent}% used</span><span>${limit > used ? `${money(limit - used, true)} left` : `${money(used - limit, true)} over`}</span></div>
  </div>`;
}
function renderBudgets() {
  const expenseCategories = categories.filter((item) => item.type === "expense" && item.budget);
  $("#budgetPreview").innerHTML = expenseCategories.slice(0, 3).map(budgetMarkup).join("");
  const totalLimit = expenseCategories.reduce((sum, item) => sum + budgetLimit(item), 0);
  const totalUsed = expenseCategories.reduce((sum, item) => sum + budgetUsed(item.name), 0);
  const overallLimit = state.budgets[`${activeMonth}:overall`] ?? totalLimit;
  $("#budgetSummary").innerHTML = `<div class="budget-summary-card"><div><p class="eyebrow">YOUR MONTHLY PLAN · ${safe(labelMonth(activeMonth).toUpperCase())}</p><h2>A little structure, lots of room.</h2><p>${money(Math.max(0, overallLimit - totalUsed), true)} left in your overall budget</p></div><div class="budget-summary-amount"><strong>${money(totalUsed, true)}</strong><small>of ${money(overallLimit, true)} planned</small></div></div>`;
  $("#allBudgets").innerHTML = expenseCategories.map(budgetMarkup).join("");
}

function openBudgetDialog() {
  const expenseCategories = categories.filter((item) => item.type === "expense" && item.budget);
  const totalLimit = expenseCategories.reduce((sum, item) => sum + budgetLimit(item), 0);
  const overallLimit = state.budgets[`${activeMonth}:overall`] ?? totalLimit;
  $("#budgetFormFields").innerHTML = `<label class="budget-field overall-field">Overall monthly budget · ₹<input type="number" min="0" step="0.01" value="${(overallLimit / 100).toFixed(2)}" data-overall-budget required></label>
    ${expenseCategories.map((item) => `<label class="budget-field">${safe(item.icon)} ${safe(item.name)} · ₹<input type="number" min="0" step="0.01" value="${(budgetLimit(item) / 100).toFixed(2)}" data-category-budget="${safe(item.name)}" required></label>`).join("")}`;
  $("#budgetDialog").showModal();
  $("#budgetFormFields input").focus();
}

function saveBudgetLimits(event) {
  event.preventDefault();
  const inputs = $$("#budgetFormFields input");
  const values = inputs.map((input) => Number(input.value));
  if (values.some((value) => !Number.isFinite(value) || value < 0 || !Number.isSafeInteger(Math.round(value * 100)))) {
    showToast("Enter valid budget amounts.");
    return;
  }
  state.budgets[`${activeMonth}:overall`] = Math.round(Number($("[data-overall-budget]").value) * 100);
  $$("[data-category-budget]").forEach((input) => {
    state.budgets[`${activeMonth}:${input.dataset.categoryBudget}`] = Math.round(Number(input.value) * 100);
  });
  $("#budgetDialog").close();
  renderAll();
  showToast("Your monthly limits are saved.");
}

function transactionRow(item, includeAccount = false) {
  const category = categoryFor(item.category);
  return `<div class="transaction-row" data-transaction-id="${safe(item.id)}">
    <div class="transaction-main"><span class="transaction-avatar">${category.icon}</span><span class="transaction-copy"><strong>${safe(item.note || item.category)}</strong><small>${safe(item.account || "Everyday account")}</small></span></div>
    <span class="transaction-category">${safe(item.category)}</span>
    <span class="transaction-date">${formatDate(item.date)}</span>
    <span class="transaction-amount ${item.type}">${item.type === "income" ? "+" : "−"}${money(item.amount)}</span>
    ${includeAccount ? `<span class="transaction-actions"><button type="button" data-action="edit" aria-label="Edit ${safe(item.note || item.category)}" title="Edit">✎</button><button type="button" data-action="delete" aria-label="Delete ${safe(item.note || item.category)}" title="Delete">×</button></span>` : ""}
  </div>`;
}
function renderRecent() {
  const transactions = transactionsForMonth(activeMonth).slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  $("#recentTransactions").innerHTML = transactions.length
    ? `<div class="transaction-list">${transactions.map((item) => transactionRow(item)).join("")}</div>`
    : `<div class="empty-state"><strong>A fresh start.</strong>Add your first transaction to see it here.</div>`;
}
function renderTransactionTable() {
  const search = $("#transactionSearch").value.trim().toLowerCase();
  const type = $("#typeFilter").value;
  const category = $("#categoryFilter").value;
  const filtered = state.transactions.filter((item) => {
    const matchesText = !search || [item.note, item.category, item.account, item.type].some((value) => String(value || "").toLowerCase().includes(search));
    return matchesText && (type === "all" || item.type === type) && (category === "all" || item.category === category);
  }).sort((a, b) => b.date.localeCompare(a.date));
  $("#transactionTable").innerHTML = filtered.length
    ? `<div class="transactions-table"><div class="table-header"><span>DESCRIPTION</span><span>CATEGORY</span><span>DATE</span><span>AMOUNT</span><span>ACTIONS</span></div><div class="transaction-list">${filtered.map((item) => transactionRow(item, true)).join("")}</div></div>`
    : `<div class="empty-state"><strong>No transactions found.</strong>Try a different search or add a new transaction.</div>`;
}

function handleTransactionAction(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const row = button.closest("[data-transaction-id]");
  const item = state.transactions.find((entry) => entry.id === row?.dataset.transactionId);
  if (!item) return;
  if (button.dataset.action === "edit") {
    openTransactionDialog(item);
    return;
  }
  state.transactions = state.transactions.filter((entry) => entry.id !== item.id);
  renderAll();
  showToast("Transaction deleted.", "Undo", () => {
    state.transactions.push(item);
    renderAll();
    showToast("Transaction restored.");
  });
}
function renderAll() {
  renderSummary();
  renderSpending();
  renderTrend();
  renderBudgets();
  renderRecent();
  renderTransactionTable();
  persist();
}

function populateCategories() {
  const type = $("#transactionForm [name=type]").value;
  const options = categories.filter((item) => item.type === type);
  $("#transactionCategory").innerHTML = options.map((item) => `<option value="${safe(item.name)}">${safe(item.icon)} ${safe(item.name)}</option>`).join("");
  $("#categoryFilter").innerHTML = `<option value="all">All categories</option>${categories.map((item) => `<option value="${safe(item.name)}">${safe(item.name)}</option>`).join("")}`;
}

function openTransactionDialog(transaction = null) {
  const form = $("#transactionForm");
  form.reset();
  editingId = transaction ? transaction.id : null;
  const type = transaction ? transaction.type : "expense";
  form.elements.type.value = type;
  form.elements.date.value = transaction ? transaction.date : todayString;
  $$(".type-option").forEach((item) => item.classList.toggle("selected", item.dataset.type === type));
  populateCategories();
  if (transaction) {
    form.elements.amount.value = (transaction.amount / 100).toFixed(2);
    form.elements.category.value = transaction.category;
    form.elements.account.value = transaction.account || accountNames[0];
    form.elements.note.value = transaction.note || "";
  }
  $("#transactionDialogTitle").textContent = transaction ? "Edit transaction" : "Add a transaction";
  $("#transactionSubmitText").textContent = transaction ? "Save changes" : "Save transaction";
  $("#transactionDialog").showModal();
  $("#amountInput").focus();
}

function saveTransaction(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const amount = Math.round(Number(data.get("amount")) * 100);
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    showToast("Enter an amount greater than zero.");
    $("#amountInput").focus();
    return;
  }
  const item = {
    id: editingId || `tx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    date: String(data.get("date")),
    amount,
    type: String(data.get("type")),
    category: String(data.get("category")),
    account: String(data.get("account")),
    note: String(data.get("note")).trim()
  };
  if (editingId) {
    const index = state.transactions.findIndex((entry) => entry.id === editingId);
    if (index >= 0) state.transactions[index] = item;
    editingId = null;
    activeMonth = monthKey(item.date);
    $("#monthSelect").value = activeMonth;
    $("#budgetMonthSelect").value = activeMonth;
    $("#transactionDialog").close();
    renderAll();
    showToast("Changes saved.");
    return;
  }
  const transactionMonth = monthKey(item.date);
  const previousBudgetUsed = budgetUsed(item.category, transactionMonth);
  state.transactions.push(item);
  const transactionId = item.id;
  activeMonth = transactionMonth;
  $("#monthSelect").value = activeMonth;
  $("#budgetMonthSelect").value = activeMonth;
  $("#transactionDialog").close();
  renderAll();
  const category = categories.find((entry) => entry.name === item.category);
  const limit = category ? budgetLimit(category, transactionMonth) : 0;
  const currentBudgetUsed = budgetUsed(item.category, transactionMonth);
  const crossedThreshold = item.type === "expense" && limit &&
    ((previousBudgetUsed / limit < 1 && currentBudgetUsed / limit >= 1) ||
     (previousBudgetUsed / limit < .8 && currentBudgetUsed / limit >= .8));
  const notification = crossedThreshold
    ? `${item.category} budget ${currentBudgetUsed >= limit ? "reached 100%" : "is at 80%"}`
    : "Transaction saved.";
  showToast(notification, "Undo", () => {
    state.transactions = state.transactions.filter((entry) => entry.id !== transactionId);
    renderAll();
    showToast("Transaction removed.");
  });
}

function switchView(view) {
  const labels = { overview: "Overview", transactions: "Transactions", budgets: "Budgets" };
  $$(".view-panel").forEach((panel) => panel.classList.toggle("hidden", panel.id !== `${view}View`));
  $$(".nav-link").forEach((link) => link.classList.toggle("active", link.dataset.view === view));
  $("#currentPageName").textContent = labels[view];
  $("#sidebar").classList.remove("open");
  if (view === "transactions") renderTransactionTable();
}

function exportCsv() {
  const rows = [["date", "amount", "type", "category", "account", "note"], ...state.transactions
    .slice().sort((a, b) => a.date.localeCompare(b.date))
    .map((item) => [item.date, (item.amount / 100).toFixed(2), item.type, item.category, item.account || "", item.note || ""])];
  const csv = rows.map((row) => row.map((field) => `"${String(field).replace(/"/g, '""')}"`).join(",")).join("\r\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  link.download = `pennywise-transactions-${todayString}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
  showToast("Your transaction CSV is ready.");
}

function parseCsv(text) {
  const rows = [];
  let row = [], value = "", quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted && char === '"' && text[index + 1] === '"') { value += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (!quoted && char === ",") { row.push(value); value = ""; }
    else if (!quoted && (char === "\n" || char === "\r")) {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      row.push(value);
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = []; value = "";
    } else value += char;
  }
  row.push(value);
  if (row.some((cell) => cell.trim())) rows.push(row);
  return rows;
}
const normalizedHeader = (value) => value.toLowerCase().replace(/[^a-z]/g, "");
function showImportPreview() {
  const fields = ["date", "amount", "type", "category", "note", "account"];
  const aliases = {
    date: ["date", "transactiondate", "posteddate"],
    amount: ["amount", "value", "total"],
    type: ["type", "transactiontype", "direction"],
    category: ["category", "merchant", "description"],
    note: ["note", "memo", "details", "description"],
    account: ["account", "accountname", "wallet"]
  };
  const options = importHeaders.map((header, index) => `<option value="${index}">${safe(header || `Column ${index + 1}`)}</option>`).join("");
  const headerSelect = (field) => {
    const found = importHeaders.findIndex((header) => aliases[field].includes(normalizedHeader(header)));
    return `<label class="field-label">${field[0].toUpperCase() + field.slice(1)}${field === "type" || field === "note" || field === "account" ? " · optional" : ""}<select data-map="${field}"><option value="">${field === "type" || field === "note" || field === "account" ? "Not included" : "Choose column"}</option>${options}</select></label>`;
  };
  $("#importContent").innerHTML = `<p class="subheading">Match your file’s columns. Nothing is imported until you confirm.</p>
    <div class="mapping-grid">${fields.map(headerSelect).join("")}</div>
    <div class="preview-title"><span>Preview</span><small id="previewCount"></small></div>
    <div class="preview-table-wrap" id="previewTable"></div>
    <div class="import-actions"><button class="button button-outline" type="button" data-import-cancel>Cancel</button><button class="button button-dark" type="button" id="confirmImport">Import transactions</button></div>`;
  fields.forEach((field) => {
    const select = $(`[data-map="${field}"]`);
    const found = importHeaders.findIndex((header) => aliases[field].includes(normalizedHeader(header)));
    if (found >= 0) select.value = String(found);
    select.addEventListener("change", renderCsvPreview);
  });
  $("[data-import-cancel]").addEventListener("click", () => $("#importDialog").close());
  $("#confirmImport").addEventListener("click", commitImport);
  renderCsvPreview();
}
function mappedValue(row, field) {
  const index = $(`[data-map="${field}"]`).value;
  return index === "" ? "" : String(row[Number(index)] || "").trim();
}
function renderCsvPreview() {
  const dataRows = importRows.slice(1, 21);
  $("#previewCount").textContent = `Showing ${dataRows.length} of ${Math.max(0, importRows.length - 1)} rows`;
  const columns = ["date", "amount", "type", "category", "note"];
  $("#previewTable").innerHTML = `<table class="preview-table"><thead><tr>${columns.map((item) => `<th>${item.toUpperCase()}</th>`).join("")}<th>STATUS</th></tr></thead><tbody>${dataRows.map((row) => {
    const mapped = Object.fromEntries(columns.map((field) => [field, mappedValue(row, field)]));
    const date = parseImportDate(mapped.date);
    const amount = parseImportAmount(mapped.amount);
    const duplicate = date && amount && state.transactions.some((item) => item.date === date && item.amount === amount && (item.note || "").toLowerCase() === mapped.note.toLowerCase());
    return `<tr>${columns.map((field) => `<td>${safe(mapped[field] || "—")}</td>`).join("")}<td>${duplicate ? "Duplicate" : date && amount ? "Ready" : "Check row"}</td></tr>`;
  }).join("")}</tbody></table>`;
}
function parseImportDate(value) {
  if (!value) return "";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : dateString(parsed);
}
function parseImportAmount(value) {
  const cleaned = String(value || "").replace(/[₹$£,\s]/g, "");
  const number = Number(cleaned);
  return Number.isFinite(number) && number > 0 ? Math.round(number * 100) : 0;
}
function commitImport() {
  const dataRows = importRows.slice(1);
  let imported = 0, skipped = 0;
  dataRows.forEach((row) => {
    const date = parseImportDate(mappedValue(row, "date"));
    const amount = parseImportAmount(mappedValue(row, "amount"));
    const note = mappedValue(row, "note");
    if (!date || !amount) { skipped += 1; return; }
    const duplicate = state.transactions.some((item) => item.date === date && item.amount === amount && (item.note || "").toLowerCase() === note.toLowerCase());
    if (duplicate) { skipped += 1; return; }
    const typeText = mappedValue(row, "type").toLowerCase();
    const type = ["income", "credit", "deposit"].some((word) => typeText.includes(word)) ? "income" : "expense";
    const categoryText = mappedValue(row, "category");
    const category = categories.find((item) => item.name.toLowerCase() === categoryText.toLowerCase());
    const accountText = mappedValue(row, "account");
    const account = accountNames.find((item) => item.toLowerCase() === accountText.toLowerCase()) || "Everyday account";
    state.transactions.push({
      id: `import-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      date, amount, type, category: category ? category.name : (type === "income" ? "Freelance" : "Other"),
      account, note
    });
    imported += 1;
  });
  renderAll();
  $("#importDialog").close();
  showToast(`${imported} imported · ${skipped} skipped`);
}

$("#transactionForm").addEventListener("submit", saveTransaction);
$("#transactionTable").addEventListener("click", handleTransactionAction);
$("#budgetForm").addEventListener("submit", saveBudgetLimits);
$("#editBudgetsButton").addEventListener("click", openBudgetDialog);
$$("[data-open-transaction]").forEach((button) => button.addEventListener("click", openTransactionDialog));
$$("[data-close-dialog]").forEach((button) => button.addEventListener("click", () => button.closest("dialog").close()));
$$(".type-option").forEach((button) => button.addEventListener("click", () => {
  $("#transactionForm [name=type]").value = button.dataset.type;
  $$(".type-option").forEach((item) => item.classList.toggle("selected", item === button));
  populateCategories();
}));
$$(".nav-link").forEach((button) => button.addEventListener("click", () => switchView(button.dataset.view)));
$$("[data-navigate]").forEach((button) => button.addEventListener("click", () => switchView(button.dataset.navigate)));
$("#monthSelect").addEventListener("change", (event) => {
  activeMonth = event.target.value;
  $("#budgetMonthSelect").value = activeMonth;
  renderAll();
});
$("#budgetMonthSelect").addEventListener("change", (event) => {
  activeMonth = event.target.value;
  $("#monthSelect").value = activeMonth;
  renderAll();
});
$("#transactionSearch").addEventListener("input", renderTransactionTable);
$("#typeFilter").addEventListener("change", renderTransactionTable);
$("#categoryFilter").addEventListener("change", renderTransactionTable);
$("#exportButton").addEventListener("click", exportCsv);
$("#importButton").addEventListener("click", () => $("#importDialog").showModal());
$("#csvFile").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  if (!file.name.toLowerCase().endsWith(".csv")) {
    showToast("Please choose a CSV file.");
    return;
  }
  const text = await file.text();
  importRows = parseCsv(text);
  if (importRows.length < 2) {
    showToast("This CSV needs a header row and at least one transaction.");
    return;
  }
  importHeaders = importRows[0];
  showImportPreview();
});
$("#mobileMenu").addEventListener("click", () => $("#sidebar").classList.toggle("open"));
document.addEventListener("keydown", (event) => {
  const target = event.target;
  const typing = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
  if ((event.key === "n" || event.key === "N") && !typing && !event.ctrlKey && !event.metaKey && !event.altKey) {
    event.preventDefault();
    openTransactionDialog();
  }
  if (event.key === "Escape") $("#sidebar").classList.remove("open");
});

setMonthOptions($("#monthSelect"));
setMonthOptions($("#budgetMonthSelect"));
populateCategories();
renderAll();
