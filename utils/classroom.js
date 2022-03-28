const {google} = require("googleapis");

async function authorize(getNewToken, callback, ...params) {
    const {client_secret, client_id, redirect_uris} = global.gapi.installed;
    const oAuth2Client = new google.auth.OAuth2(
        client_id, client_secret, redirect_uris[0]);
    if (global.classroomtoken) {
        oAuth2Client.setCredentials(global.classroomtoken);
        return await callback(oAuth2Client, ...params);
    } else {
        return await getNewToken(oAuth2Client, callback, params);
    }
}



function listCourses(auth, pageSize=10) {
    const classroom = google.classroom({version: 'v1', auth});
    return new Promise((resolve, reject) => {
        classroom.courses.list({
            pageSize: pageSize,
        }, (err, res) => {
            if (err) {
                reject(err);
                return;
            }
            const courses = res.data.courses;
            if (courses && courses.length) {
                resolve(courses);
            } else {
                resolve([]);
                console.log('No courses found.');
            }
        });
    });
}

function getCourse(auth, courseId) {
    const classroom = google.classroom({version: 'v1', auth});
    return new Promise((resolve, reject) => {
        classroom.courses.get({
            id: courseId
        }, (err, res) => {
            if (err) {
                reject(err);
                return;
            }
            const courses = res.data;
            if (courses) {
                resolve(courses);
            } else {
                resolve(undefined);
                console.log('No course found.');
            }
        });
    });
}

function getCourseWorks(auth, courseId) {
    const classroom = google.classroom({version: 'v1', auth});
    return new Promise((resolve, reject) => {
        classroom.courses.courseWork.list({
            courseId
        }, (err, res) => {
            if (err) {
                reject(err);
                return;
            }
            const workList = res.data;
            if (workList.courseWork) {
                resolve(workList.courseWork);
            } else {
                resolve([]);
                console.log('No workList found.');
            }
        });
    });
}

function getCourseWorkSubmissions(auth, courseId, courseWorkId, userId="me") {
    const classroom = google.classroom({version: 'v1', auth});
    return new Promise((resolve, reject) => {
        classroom.courses.courseWork.studentSubmissions.list({
            courseId, courseWorkId, userId
        }, (err, res) => {
            if (err) {
                reject(err);
                return;
            }
            const workList = res.data;
            if (workList.studentSubmissions) {
                resolve(workList.studentSubmissions);
            } else {
                resolve([]);
                console.log('No workList found.');
            }
        });
    });
}

function turnInSubmission(auth, courseId, courseWorkId, submissionId) {
    const classroom = google.classroom({version: 'v1', auth});
    return new Promise((resolve, reject) => {
        classroom.courses.courseWork.studentSubmissions.turnIn({
            courseId, courseWorkId, id: submissionId
        }, (err, res) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(true);
        });
    });
}




module.exports = {
    authorize, listCourses, getCourse, getCourseWorks, getCourseWorkSubmissions, turnInSubmission
}