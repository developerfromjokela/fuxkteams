const { app, ipcMain, dialog, shell} = require('electron');
const debug = process.env.ADFRIFY_DEBUG || false;
const windowUtils = require('./utils/window')
const puppeteer = require('puppeteer-extra');
const SCOPES = ['https://www.googleapis.com/auth/classroom.courses', 'https://www.googleapis.com/auth/classroom.coursework.me', 'https://www.googleapis.com/auth/classroom.profile.photos', 'https://www.googleapis.com/auth/classroom.announcements', 'https://www.googleapis.com/auth/classroom.courseworkmaterials' ,'https://www.googleapis.com/auth/classroom.rosters'];
const prompt = require('electron-prompt');
const {authorize, listCourses, getCourse, getCourseWorks, getCourseWorkSubmissions, turnInSubmission} = require('./utils/classroom');
const express = require('express');
const StealthPlugin = require('puppeteer-extra-plugin-stealth')
puppeteer.use(StealthPlugin())
const uuid = require('uuid');

const teamsDataDir = "/tmp/teams-"+uuid.v4()
const classroomDataDir = "/tmp/classroom-"+uuid.v4()
const {googletoken} = require('./google')

global.gapi = googletoken;
    
let teamsConfiguration = {
    teamsUrl: null,
    joinTimestamp: null,
    configLocked: false,
    browserUrl: null,
    name: null
}

let classroomConfiguration = {
    course: null,
    configLocked: false
}

let teamsTimer = undefined;
let classroomTimer = undefined;
let teamsWindow = undefined;
let classroomWindow = undefined;

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit()
})

function isValidHttpUrl(string) {
    let url;

    try {
        url = new URL(string);
    } catch (_) {
        return false;
    }
    return url.protocol === "http:" || url.protocol === "https:";
}

const broadcastError = (title, desc) => {
    ipcMain.emit('failure', title, desc)
    dialog.showErrorBox(title, desc);
}

const startTimer = (countDownDate, win) => {
    teamsTimer = setInterval(function () {
        let now = new Date().getTime();

        // Find the distance between now and the countdown date
        let distance = countDownDate - now;

        // Time calculations for days, hours, minutes and seconds
        let days = Math.floor(distance / (1000 * 60 * 60 * 24));
        let hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        let minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        let seconds = Math.floor((distance % (1000 * 60)) / 1000);

        if (distance > 0 || distance === 0) {
            let str = "";
            str += `${days} p??iv??(??)`
            str += `, ${hours} tunti(a)`
            str += `, ${minutes} minuutti(a)`
            str += `, ${seconds} sekunti(a)`
            win.webContents
                .send('teams-counter', str)
        }

        if (distance < 0) {
            clearInterval(teamsTimer);
            console.log("CLEAR!");
            joinMeeting(win);
        }
    }, 1000);
};

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


const submitClassroom = async (work, win) => {
    let newPage;
    try {
        newPage = await classroomWindow.newPage();
    } catch (e) {
        classroomWindow = await configureClassroomWindow(undefined, undefined, true);
        newPage = await classroomWindow.newPage();
    }
    await newPage.goto(work.alternateLink)
    try {
        await newPage.waitForSelector('div[guidedhelpid="turnInButton"]', {timeout: 60000});
    } catch (e) {
        console.error(e);
    }
    try {
        await newPage.waitForSelector('div[guidedhelpid="submissionManager_markAsDone"]', {timeout: 6000});
    } catch (e) {
        console.error(e);
    }
    try {
        await newPage.click('div[guidedhelpid="turnInButton"]');
    } catch (e) {
        console.error(e);
    }
    try {
        await newPage.click('div[guidedhelpid="submissionManager_markAsDone"]');
    } catch (e) {
        console.error(e);
    }
    try {
        await sleep(1000);
        await newPage.keyboard.press('Tab');
        await sleep(500);
        await newPage.keyboard.press('Tab');
        await sleep(500);
        await newPage.keyboard.press('Enter');
    } catch (e) {

    }
    try {
        win.webContents
            .send('success', 'classroom-link')
    } catch (e) {console.error(e)}
    dialog.showMessageBox({title: "Teht??v?? l??hetetty!", message: "Classroom teht??v?? on palautettu"});
}

const startMonitor = (course, win) => {
    let lastId = undefined;
    dialog.showMessageBox({title: "Valvonta aloitettu", message: "Anna ohjelman py??ri??. Kun se havaitsee uuden classroom-teht??v??n, se merkitsee sen tehdyksi."});
    classroomTimer = setInterval(function () {
        authorize(getNewToken, getCourseWorks, course.id).then(list => {
            console.log("Checking classroom");
            if (lastId === undefined) {
                lastId = list[0].id;
                return;
            }
            if (lastId !== list[0].id) {
                // found!
                win.webContents
                    .send('classroom-monitor', "UUSI: "+list[0].title);
                clearInterval(classroomTimer);
                submitClassroom(list[0], win);
            } else {
                win.webContents
                    .send('classroom-monitor', list[0].title);
            }
        });
    }, 10000);
};

const joinMeeting = async (win) => {
    let newPage;
    try {
        newPage = await teamsWindow.newPage();
    } catch (e) {
        classroomWindow = await configureTeamsWindow(undefined, true);
        newPage = await teamsWindow.newPage();
    }
    await newPage.goto(teamsConfiguration.browserUrl);
    try {
        if (newPage.url().includes("launcher.html")) {
            await newPage.click("button[data-tid=\"joinOnWeb\"]")
            await newPage.waitForSelector("button[track-summary=\"Continue in call/meetup without device access\"]", {timeout: 60000});
            await newPage.click("button[track-summary=\"Continue in call/meetup without device access\"]");
        }
    } catch (e) {
        console.error(e);
    }
    try {
        if (!newPage.url().includes("pre-join-calling"))
            await newPage.waitForFunction("window.location.href.includes('pre-join-calling')")
        try {
            await newPage.waitFor('#username')
            await newPage.focus('#username')
            await newPage.keyboard.type(teamsConfiguration.name ?? "vieras");
        } catch (e) {
            console.log(e);
        }
        await newPage.waitFor(() => document.querySelector(".join-btn"));
        await newPage.click(".join-btn");
        await newPage.waitFor(() => !document.querySelector(".join-btn"));
        dialog.showMessageBox({title: "Suoritettu onnistuneesti", message: "Liitin sinut teamsiin!"});
        try {
            win.webContents
                .send('success', 'teams-link')
        } catch (e) {console.error(e)}
    } catch (e) {
        console.error(e);
        // try alternative / start from scratch
        await newPage.goto(teamsConfiguration.teamsUrl);
        try {
            if (newPage.url().includes("launcher.html")) {
                await newPage.click("button[data-tid=\"joinOnWeb\"]")
                await newPage.waitForSelector("button[track-summary=\"Continue in call/meetup without device access\"]", {timeout: 60000});
                await sleep(3000);
                await newPage.click("button[track-summary=\"Continue in call/meetup without device access\"]");
                await sleep(3000);
            }
        } catch (e) {
            console.error(e);
        }
        await newPage.waitForFunction("window.location.href.includes('pre-join-calling')")
        try {
            await newPage.waitFor('#username')
            await newPage.focus('#username')
            await newPage.keyboard.type(teamsConfiguration.name ?? "vieras");
        } catch (e) {
            console.log(e);
        }
        await newPage.click(".join-btn");
        await newPage.waitFor(() => !document.querySelector(".join-btn"));
        dialog.showMessageBox({title: "Suoritettu onnistuneesti", message: "Liitin sinut teamsiin!"});
        teamsConfiguration.configLocked = false;
        try {
            win.webContents
                .send('success', 'teams-link')
        } catch (e) {console.error(e)}
    }
}

const configureTeamsWindow = async (win, noInit=false) => {
    const browserFetcher = puppeteer.createBrowserFetcher();
    const localChromiums = await browserFetcher.localRevisions();
    console.log(localChromiums);
    if(!localChromiums.length) return console.error('Can\'t find installed Chromium');
    const { executablePath } = await browserFetcher.revisionInfo(localChromiums[0]);
    console.log(executablePath);

    teamsWindow = await puppeteer.launch({
        executablePath: executablePath,
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        dumpio: true,
        userDataDir: teamsDataDir
    });
    console.log("Launch!");
   if (!noInit) {
       let teamsPage = await teamsWindow.newPage();
       await teamsPage.goto(teamsConfiguration.teamsUrl);
       await teamsPage.waitForFunction("window.location.href.includes('pre-join-calling')", {timeout: 0})
       console.log("Done!");
       teamsConfiguration.browserUrl = teamsPage.url()
        const name = await prompt({title: "Nimi", label: "Sy??t?? nimesi"})
        if (name === null) {
            throw new Error("Sy??t?? nimi!");
        }
        teamsConfiguration.name = name;
        dialog.showMessageBox({title: "Teams valmiina", message: "S????d?? tarvittaessa asetukset ja anna ohjelman olla p????ll??."});
        startTimer(Date.parse(teamsConfiguration.joinTimestamp), win)
    }
}

const configureClassroomWindow = async (course, win, noInit=false) => {
    if (!noInit)
        dialog.showMessageBox({title: "Kirjaudu classroomiin", message: "Kirjaudu classroomiin uudessa selainikkunassa, mutta ??l?? sulje ikkunaa sen j??lkeen!"});
    const browserFetcher = puppeteer.createBrowserFetcher();
    const localChromiums = await browserFetcher.localRevisions();
    console.log(localChromiums);
    if(!localChromiums.length) return console.error('Can\'t find installed Chromium');
    const { executablePath } = await browserFetcher.revisionInfo(localChromiums[0]);
    console.log(executablePath);

    classroomWindow = await puppeteer.launch({
        executablePath: executablePath,
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        dumpio: true,
        userDataDir: classroomDataDir
    });
    console.log("Launch!");
    if (!noInit) {
        let classroomPage = await classroomWindow.newPage();
        await classroomPage.goto(course.alternateLink);
        await classroomPage.waitForFunction("window.location.href.includes('classroom.google.com/c/')", {timeout: 0})
        console.log("Done!");
        startMonitor(course, win);
    }

}

async function getNewToken(oAuth2Client, callback, params) {
    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
        redirect_uri: undefined
    });
    await shell.openExternal(authUrl)
    const app = express()
    const port = 45445
    let server = null;
    let result = await new Promise((resolve, reject) => {
        try {
            app.get('/', (req, res) => {
                res.send("OK");
                server.close();
                resolve(req.query["code"]);
            })
            server = app.listen(port, () => {
                console.log(`Auth listening on port ${port}`)
            })
        } catch (e) {
            reject(e);
        }
    });
    if (result == null) {
        dialog.showErrorBox("Kirjautuminen ep??onnistui", "No code received");
        return;
    }
    return await new Promise((resolve, reject) => {
        oAuth2Client.getToken(result, (err, token) => {
            if (err) {
                dialog.showErrorBox("Kirjautuminen ep??onnistui", err.toString());
                reject();
                return;
            }
            oAuth2Client.setCredentials(token);
            // Store the token to disk for later program executions
            global.classroomtoken = token;
            resolve(callback(oAuth2Client, ...params));
        });
    })
}


const registerIPCCalls = (window) => {
    ipcMain.on('set-teams-link', (event, args) => {
        if (args) {
            if (!isValidHttpUrl(args.link)) {
                broadcastError('Virheellinen teams-linkki', 'Lis???? oikea teams-linkki ja yrit?? uudelleen');
                return;
            }
            if (isNaN(Date.parse(args.time))) {
                broadcastError('P??iv??m????r?? ja aika', 'Aseta oikea p??iv??m????r?? ja aika ja yrit?? uudelleen')
                return;
            }
            teamsConfiguration.joinTimestamp = args.time;
            teamsConfiguration.teamsUrl = args.link;
            teamsConfiguration.configLocked = true;
            dialog.showMessageBox({title: "Melkein valmista", message: "Jatka teamsiin, mutta ??l?? viel?? liity puheluun"});
            configureTeamsWindow(window);
            //startTimer(Date.parse(teamsConfiguration.joinTimestamp), window);
            event.reply('success', 'teams-link')
        } else {
            broadcastError( 'IPC', 'No arguments');
        }
    })
    ipcMain.on('get-teams', (event, args) => {
        event.reply('teams', teamsConfiguration)
    })
    ipcMain.on('get-classroom', (event, args) => {
        let config = JSON.parse(JSON.stringify(classroomConfiguration));
        config.loggedIn = global.classroomtoken !== undefined;
        event.reply('classroom', config)
    })
    ipcMain.on('login-classroom', async (event, args) => {
        try {
            let content = await authorize(getNewToken, listCourses, 30);
            let config = JSON.parse(JSON.stringify(classroomConfiguration));
            config.loggedIn = global.classroomtoken !== undefined;
            config.courses = content;
            event.reply('classroom', config)
        } catch (e) {
            dialog.showErrorBox("Kirjautuminen ep??onnistui", e.toString());
            console.error(e);
        }
    })

    ipcMain.on('get-classroom-courses', async (event, args) => {
        try {
            let content = await authorize(getNewToken, listCourses, 30);
            let config = JSON.parse(JSON.stringify(classroomConfiguration));
            config.loggedIn = global.classroomtoken !== undefined;
            config.courses = content;
            event.reply('classroom', config)
        } catch (e) {
            dialog.showErrorBox("Kirjautuminen ep??onnistui", e.toString());
            console.error(e);
        }
    })
    ipcMain.on('start-classroom', async (event, args) => {
        try {
            let course = await authorize(getNewToken, getCourse, args);
            console.log(course);
            let work = await authorize(getNewToken, getCourseWorks, course.id);
            console.log(work);
            classroomConfiguration.configLocked = true;
            let config = JSON.parse(JSON.stringify(classroomConfiguration));
            config.loggedIn = global.classroomtoken !== undefined;
            await configureClassroomWindow(course, window);
            event.reply('classroom', config)
        } catch (e) {
            dialog.showErrorBox("Kirjautuminen ep??onnistui", e.toString());
            console.error(e);
        }
    })
}


app.whenReady().then(() => {
    let win = windowUtils.createMainWindow();
    registerIPCCalls(win);
})

