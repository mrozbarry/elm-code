const gulp = require("gulp")
const gulpSass = require("gulp-sass")

gulp.task("sass", function () {
  return gulp
    .src("./app/assets/styles/*.sass")
    .pipe(gulpSass().on("error", gulpSass.logError))
    .pipe(gulp.dest("./public/assets"))
})
