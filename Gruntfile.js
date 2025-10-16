module.exports = function(grunt) {
  grunt.initConfig({
    concat: {
      options: {
        separator: '\n\n'
      },
      dist: {
        src: [
          'src/00-header.js',
          'src/01-ui.js',
          'src/02-buttons.js',
          'src/03-settings-ui.js',
          'src/04-custom-rules.js',
          'src/05-settings-management.js',
          'src/06-autosave.js',
          'src/07-editor-tools.js',
          'src/08-number-conversion.js',
          'src/09-auto-fix.js',
          'src/10-editor-formatting.js',
          'src/11-init.js'
        ],
        dest: 'scribetools.user.js'
      }
    }
  });

  grunt.loadNpmTasks('grunt-contrib-concat');

  grunt.registerTask('default', ['concat']);
};
