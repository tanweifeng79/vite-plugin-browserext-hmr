import { createApp, defineAsyncComponent } from "vue";
import "./style/base.css";
import "uno.css";
// import "./content/index.ts";
// import "./service-worker/index.ts";

createApp(defineAsyncComponent(() => import("./DevtoolsApp.vue"))).mount(
  "#app"
);
