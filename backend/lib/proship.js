const axios = require("axios");

let proshipToken = null;
let proshipTokenExpiry = null;

async function getProshipToken() {
  if (proshipToken && proshipTokenExpiry && Date.now() < proshipTokenExpiry) {
    return proshipToken;
  }
  const response = await axios.post("https://proship.prozo.com/api/auth/signin", {
    username: process.env.PROSHIP_USERNAME,
    password: process.env.PROSHIP_PASSWORD,
  });
  proshipToken = response.data.accessToken;
  proshipTokenExpiry = Date.now() + 50 * 60 * 1000;
  return proshipToken;
}

async function fetchProshipDeliveries(countCall) {
  const token = await getProshipToken();
  const now = new Date();
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  const today = ist.toISOString().split("T")[0];

  countCall("proship");
  const countResponse = await axios({
    method: "GET",
    url: "https://proship.prozo.com/api/order/external/details",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    data: {
      updated_from: today,
      updated_to: today,
      offset: 0,
      limit: 1,
      order_status: "DELIVERED",
    },
  });

  const totalCount = countResponse.data?.pagination?.totalCount || 0;

  let deliveries = [];
  if (totalCount > 0) {
    const PAGE_SIZE = 50;
    const pages = Math.ceil(totalCount / PAGE_SIZE);

    for (let page = 0; page < pages; page++) {
      countCall("proship");
      const detailsResponse = await axios({
        method: "GET",
        url: "https://proship.prozo.com/api/order/external/details",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        data: {
          updated_from: today,
          updated_to: today,
          offset: page * PAGE_SIZE,
          limit: PAGE_SIZE,
          order_status: "DELIVERED",
        },
      });

      const pageData = (detailsResponse.data?.data || []).map((order) => ({
        orderId: order.clientOrderId || order.orderId || "",
        customerName: order.deliveryDetails?.to_name || order.customerDetail?.toName || "",
        awb: order.awbNumber || "",
        courier: order.actualCourierProviderName || order.courierDetail?.parent || "",
        deliveryDate: order.actualDeliveryTime || order.lastStatusUpdateTime || "",
        city: order.deliveryDetails?.to_city || order.customerDetail?.toCity || "",
        state: order.deliveryDetails?.to_state || order.customerDetail?.toState || "",
        paymentMode: order.paymentMode || "",
        invoiceValue: order.invoiceValue || 0,
        status: order.orderStatus || "DELIVERED",
      }));

      deliveries = deliveries.concat(pageData);
    }
  }

  return { count: totalCount, deliveries };
}

module.exports = { getProshipToken, fetchProshipDeliveries };
