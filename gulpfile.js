const gulp = require('gulp');
const ts = require('gulp-typescript');
const tsProject = ts.createProject('tsconfig.json');

gulp.task('compile', function (done) {
  return tsProject.src()
    .pipe(tsProject())
    .js.pipe(gulp.dest('dist'));
});

gulp.task('copy', function () {
  return gulp.src('./src/lua/*.lua')
    .pipe(gulp.dest('./dist/lua'));
});

gulp.task('watch', function () {
  gulp.watch('src/**/*', gulp.series('compile', 'copy'));
});

gulp.task('default', gulp.series('compile', 'copy'))