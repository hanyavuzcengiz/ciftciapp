import http from "k6/http";
import { check } from "k6";

export const options = {
  scenarios: {
    list_1000_users: {
      executor: "constant-vus",
      vus: 1000,
      duration: "60s"
    }
  },
  thresholds: {
    http_req_duration: ["p(95)<500"],
    http_req_failed: ["rate<0.001"]
  }
};

export default function () {
  const res = http.get("http://localhost:3000/api/v1/listings");
  check(res, { "status is 200": (r) => r.status === 200 });
}
