const gulp = require('gulp');
const exec = require('child_process').exec;

gulp.task('compile', function (done) {
  exec('npm run compile', function (err, stdOut, stdErr) {
    console.log(stdOut);
    if (err){
      done(err);
    } else {
      done();
    }
  });
});

gulp.task('copy', function () {
  return gulp.src('./src/lua/*.lua')
    .pipe(gulp.dest('./dist/lua'));
});

gulp.task('watch', function () {
  gulp.watch('src/**/*', gulp.series('compile', 'copy'));
});

gulp.task('default', gulp.series('compile', 'copy'))