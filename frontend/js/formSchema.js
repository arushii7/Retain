/**
 * Single source of truth for the Churn Prediction form.
 * Field `name`s are the ORIGINAL dataset column names — they are sent to the backend unchanged.
 * Ranges and dropdown options should mirror the data the model was trained on; edit them here if yours differ.
 */
(function (R) {
  'use strict';

  function opts() {
    return Array.prototype.slice.call(arguments).map(function (v) { return { value: String(v), label: String(v) }; });
  }

  var GROUPS = [
    {
      id: 'profile',
      title: 'Customer profile',
      description: 'Who the customer is and how long they have been with you.',
      fields: [
        { name: 'Tenure', label: 'Tenure', type: 'slider', min: 0, max: 61, step: 1, integer: true, unit: 'months', hint: 'Months since the customer joined.' },
        { name: 'Gender', label: 'Gender', type: 'select', options: opts('Male', 'Female') },
        { name: 'MaritalStatus', label: 'Marital status', type: 'select', options: opts('Single', 'Married', 'Divorced') },
        { name: 'CityTier', label: 'City tier', type: 'select', numeric: true, options: [{ value: '1', label: 'Tier 1' }, { value: '2', label: 'Tier 2' }, { value: '3', label: 'Tier 3' }] },
        { name: 'NumberOfAddress', label: 'Number of addresses', type: 'number', min: 1, max: 22, step: 1, integer: true, hint: 'Saved delivery addresses.' },
      ],
    },
    {
      id: 'engagement',
      title: 'App engagement',
      description: 'How the customer shops and pays.',
      fields: [
        { name: 'PreferredLoginDevice', label: 'Preferred login device', type: 'select', options: opts('Mobile Phone', 'Computer') },
        { name: 'HourSpendOnApp', label: 'Hours spent on app', type: 'slider', min: 0, max: 5, step: 0.5, unit: 'hrs', hint: 'Average daily hours.' },
        { name: 'NumberOfDeviceRegistered', label: 'Devices registered', type: 'number', min: 1, max: 6, step: 1, integer: true },
        { name: 'PreferedOrderCat', label: 'Preferred order category', type: 'select', options: opts('Laptop & Accessory', 'Mobile Phone', 'Mobile', 'Fashion', 'Grocery', 'Others') },
        { name: 'PreferredPaymentMode', label: 'Preferred payment mode', type: 'select', options: opts('Debit Card', 'Credit Card', 'UPI', 'E wallet', 'Cash on Delivery') },
      ],
    },
    {
      id: 'orders',
      title: 'Orders & incentives',
      description: 'Purchasing behaviour and promotions.',
      fields: [
        { name: 'OrderCount', label: 'Order count', type: 'number', min: 1, max: 16, step: 1, integer: true, hint: 'Orders in the last month.' },
        { name: 'DaySinceLastOrder', label: 'Days since last order', type: 'slider', min: 0, max: 46, step: 1, integer: true, unit: 'days' },
        { name: 'OrderAmountHikeFromlastYear', label: 'Order amount hike vs last year', type: 'slider', min: 11, max: 26, step: 1, integer: true, unit: '%' },
        { name: 'CouponUsed', label: 'Coupons used', type: 'number', min: 0, max: 16, step: 1, integer: true, hint: 'Coupons used in the last month.' },
        { name: 'CashbackAmount', label: 'Cashback amount', type: 'slider', min: 0, max: 325, step: 1, hint: 'Average cashback received.' },
        { name: 'WarehouseToHome', label: 'Warehouse to home', type: 'slider', min: 5, max: 127, step: 1, integer: true, unit: 'km', hint: 'Distance from warehouse to customer.' },
      ],
    },
    {
      id: 'satisfaction',
      title: 'Satisfaction',
      description: 'Customer sentiment signals.',
      fields: [
        { name: 'SatisfactionScore', label: 'Satisfaction score', type: 'slider', min: 1, max: 5, step: 1, integer: true, unit: '/ 5' },
        { name: 'Complain', label: 'Complaint raised (last month)', type: 'select', numeric: true, options: [{ value: '0', label: 'No' }, { value: '1', label: 'Yes' }] },
      ],
    },
  ];

  var ALL = [];
  GROUPS.forEach(function (g) { ALL = ALL.concat(g.fields); });

  /** Order in which features are sent to the API. */
  var PAYLOAD_ORDER = [
    'Tenure', 'CityTier', 'WarehouseToHome', 'PreferredLoginDevice', 'PreferredPaymentMode', 'Gender',
    'PreferedOrderCat', 'MaritalStatus', 'HourSpendOnApp', 'NumberOfDeviceRegistered', 'SatisfactionScore',
    'NumberOfAddress', 'Complain', 'OrderAmountHikeFromlastYear', 'CouponUsed', 'OrderCount', 'DaySinceLastOrder', 'CashbackAmount',
  ];

  var BY_NAME = {};
  ALL.forEach(function (f) { BY_NAME[f.name] = f; });

  /** Convenience values so the form can be exercised quickly. These are inputs, not results. */
  var SAMPLE = {
    Tenure: '4', CityTier: '3', WarehouseToHome: '24', PreferredLoginDevice: 'Mobile Phone', PreferredPaymentMode: 'Cash on Delivery',
    Gender: 'Female', PreferedOrderCat: 'Fashion', MaritalStatus: 'Single', HourSpendOnApp: '2', NumberOfDeviceRegistered: '4',
    SatisfactionScore: '2', NumberOfAddress: '5', Complain: '1', OrderAmountHikeFromlastYear: '14', CouponUsed: '1',
    OrderCount: '2', DaySinceLastOrder: '18', CashbackAmount: '120',
  };

  function validateField(field, raw) {
    var value = raw === undefined || raw === null ? '' : String(raw).trim();
    if (value === '') return field.label + ' is required.';
    if (field.type === 'select') {
      return field.options.some(function (o) { return o.value === value; }) ? '' : 'Choose a valid ' + field.label.toLowerCase() + '.';
    }
    var n = Number(value);
    if (!isFinite(n)) return 'Enter a valid number.';
    if (field.integer && Math.floor(n) !== n) return 'Enter a whole number.';
    if (n < field.min || n > field.max) return 'Must be between ' + field.min + ' and ' + field.max + '.';
    return '';
  }

  R.form = {
    GROUPS: GROUPS,
    ALL_FIELDS: ALL,
    PAYLOAD_ORDER: PAYLOAD_ORDER,
    SAMPLE_VALUES: SAMPLE,
    emptyValues: function () {
      var o = {};
      ALL.forEach(function (f) { o[f.name] = ''; });
      return o;
    },
    validateField: validateField,
    validateAll: function (values) {
      var errors = {};
      ALL.forEach(function (f) {
        var msg = validateField(f, values[f.name]);
        if (msg) errors[f.name] = msg;
      });
      return errors;
    },
    /** Original (un-encoded, un-scaled) features, exactly as the backend pipeline expects them. */
    buildPayload: function (values) {
      var payload = {};
      PAYLOAD_ORDER.forEach(function (name) {
        var f = BY_NAME[name];
        var raw = String(values[name]).trim();
        payload[name] = f.type === 'select' && !f.numeric ? raw : Number(raw);
      });
      return payload;
    },
  };
})(window.RETAIN);
