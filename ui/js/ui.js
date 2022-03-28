const ipcRenderer = require('electron').ipcRenderer
let currentPage = undefined;

const initUIListeners = () => {
    let teamsTab = document.getElementById("teams");
    let classroomTab = document.getElementById("classroom");
    teamsTab.onclick = () => {changeContent("teams")}
    classroomTab.onclick = () => {changeContent("classroom")}
}

const changeContent = async (pageName) => {
    currentPage = pageName;
    for (let child of document.getElementById("tabs").children) {
        child.classList.remove("active");
    }
    document.getElementById(pageName).classList.add("active");
    let content = await fetch(`pages/${pageName}.html`);
    document.getElementById("content").innerHTML = (await content.text());
    initPage(pageName);
}

const initPage = (pageName) => {
    console.log(pageName);
    if (pageName === "teams") {
        ipcRenderer.send("get-teams");
    } else if (pageName === "classroom") {
        ipcRenderer.send("get-classroom");
    }
}

const initIPCListener = () => {
    ipcRenderer.on('success', (_, successToAction) => {
        if (successToAction ===  'teams-link') {
            initPage("teams");
        }
    })
    ipcRenderer.on('failure', (_, args) => {
        console.log(args);
    })
    ipcRenderer.on('teams', (_, args) => {
        updateTeamsUI(args);
    })
    ipcRenderer.on('classroom', (_, args) => {
        updateClassroomUI(args);
    })
    ipcRenderer.on('teams-counter', (_, time) => {
        console.log(time);
        if (currentPage === "teams") {
            document.getElementById("tillTeams").innerHTML = time;
        }
    })
    ipcRenderer.on('classroom-monitor', (_, status) => {
        document.getElementById("classroom-status").innerHTML = status+", viimeksi päivitetty: "+new Date().toLocaleTimeString();
    })
}

// Teams

const updateTeamsUI = (config) => {
    console.log(config);
    let startButton = document.getElementById("start-teams");
    let clear = document.getElementById("clear-teams");
    let form = document.getElementById("teams-form");
    if (config.configLocked) {
        startButton.setAttribute("disabled", "disabled");
        clear.setAttribute("disabled", "disabled");
        for (let elem of form.querySelectorAll("input")) {
            elem.setAttribute("disabled", "disabled");
        }
    } else {
        startButton.removeAttribute("disabled");
        clear.removeAttribute("disabled");
        for (let elem of form.querySelectorAll("input")) {
            elem.removeAttribute("disabled");
        }
    }

    document.getElementById("teamslink").value = config.teamsUrl;
    document.getElementById("jointime").value = config.joinTimestamp;
}

// Classroom

const updateClassroomUI = (config) => {
    console.log(config);
    document.getElementById("sign-in").style.display = config.loggedIn ? "none" : "block";
    document.getElementById("classroom-content").style.display = !config.loggedIn ? "none" : "block";
    if (config.loggedIn) {
        // get classes
        if (!config.courses) {
            ipcRenderer.send('get-classroom-courses');
        } else {
            renderClasses(config.courses);
        }
    }
}



// Start
initIPCListener();
initUIListeners();
changeContent("teams");