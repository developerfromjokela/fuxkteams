function loginClassroom() {
    ipcRenderer.send('login-classroom');
}

function renderClasses(classes) {
    console.log(classes);
    let selector = document.getElementById("courses");
    selector.innerHTML = "";
    for (let gclassroom of classes) {
        selector.innerHTML = selector.innerHTML + `<option value='${gclassroom.id}'>${gclassroom.section ?? ""}${gclassroom.name}</option>`
    }
}

function startClassroom() {
    let selector = document.getElementById("courses");
    ipcRenderer.send('start-classroom', selector.value)
}