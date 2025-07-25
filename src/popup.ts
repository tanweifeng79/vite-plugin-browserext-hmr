import { createApp, defineAsyncComponent } from "vue";
import "./style/base.css";
// import "./content/index.ts";
// import "./service-worker/index.ts";
import "uno.css";
createApp(defineAsyncComponent(() => import("./PopupApp.vue"))).mount("#app");
