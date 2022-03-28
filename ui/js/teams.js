
function emptyTeamsForm() {
    let form = document.getElementById("teams-form");
    for (let elem of form.querySelectorAll("input")) {
        elem.value = null;
    }
}

function startTeams() {
    let link = document.getElementById("teamslink");
    let time = document.getElementById("jointime");
    ipcRenderer.send('set-teams-link', {link: link.value, time: time.value});
}