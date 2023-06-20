pipeline {
  agent any
  stages {
    stage('Checkout Code') {
      steps {
        git(changelog: true, url: 'https://github.com/PaulUno777/compliance-service.git', branch: 'master')
      }
    }

  }
}