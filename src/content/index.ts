import {
  createApp,
  //   createVaporApp,
  //   vaporInteropPlugin,
  //   defineAsyncComponent,
} from "vue";
import "../style/base.css";
// import ElementPlus from "element-plus";
import ContentApp from "./ContentApp.vue";
// import ContentApp from "./ContentApp.vue";
import "element-plus/dist/index.css";
// import "uno.css";

const cpnentDiv = document.createElement("div");
cpnentDiv.id = "cpnentDivApp";
cpnentDiv.style.cssText = `
position: fixed; 
top: 0; 
left: 0;
z-index: 999;
`;
document.body.appendChild(cpnentDiv);
console.log(1113);

createApp(ContentApp).mount("#cpnentDivApp");
// createVaporApp(ContentApp).use(vaporInteropPlugin).mount("#cpnentDivApp");
// createApp(ContentApp).use(ElementPlus).mount("#cpnentDivApp");
