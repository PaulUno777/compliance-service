pipeline {
  agent any
  stages {
    stage('Checkout commit') {
      steps {
        git(url: 'https://github.com/PaulUno777/compliance-service.git', branch: 'master')
      }
    }

    stage('Log projet contain') {
      steps {
        sh '''touch .env; ls -la'''
      }
    }

    stage('Add env variables') {
      environment {
        DATABASE_URL = '\'mongodb+srv://sanctionsexplorer:Sancti0nsP4ss@cluster0.nq3ns.gcp.mongodb.net/sanctionsexplorer?retryWrites=true&w=majority\''
        PER_PAGE = '20'
        PORT = '3000'
        FILE_LOCATION = '\'public/\''
        DOWNLOAD_URL = 'http://sandbox.kamix.io:3000/api/search/download/'
        DETAIL_URL = 'http://sandbox.kamix.io:5000/sanction/'
        ITA_SOURCE = 'https://data.trade.gov/downloadable_consolidated_screening_list/v1/consolidated.json'
        SOURCE_DIR = '\'sanctions_source/\''
        DGT_SOURCE = '\'https://gels-avoirs.dgtresor.gouv.fr/ApiPublic/api/v1/publication/derniere-publication-flux-json\''
        UN_SOURCE = '\'https://scsanctions.un.org/resources/xml/fr/consolidated.xml\''
        UE_SOURCE = '\'https://webgate.ec.europa.eu/fsd/fsf/public/files/xmlFullSanctionsList_1_1/content?token=dG9rZW4tMjAxNw\''
      }
      steps {
        sh '''echo DATABASE_URL=${DATABASE_URL} >> .env;
echo PER_PAGE=${PER_PAGE} >> .env;
echo PORT=${PORT} >> .env;
echo FILE_LOCATION=${FILE_LOCATION} >> .env;
echo DOWNLOAD_URL=${DOWNLOAD_URL} >> .env;
echo SOURCE_DIR=${SOURCE_DIR} >> .env;
echo DETAIL_URL=${DETAIL_URL} >> .env;
echo ITA_SOURCE=${ITA_SOURCE} >> .env;
echo DGT_SOURCE=${DGT_SOURCE} >> .env;
echo UN_SOURCE=${UN_SOURCE} >> .env;
echo UE_SOURCE=${UE_SOURCE} >> .env;
'''
        sh 'cat .env'
      }
    }

    stage('Build app') {
      parallel {
        stage('Build app') {
          steps {
            sh 'docker build -t unoteck/kmx-compliance-service .'
          }
        }

        stage('Log into Dockerhub') {
          environment {
            DOCKER_USER = 'unoteck'
            DOCKER_PASSWORD = 'David.lock#2023'
          }
          steps {
            sh 'docker login -u $DOCKER_USER -p $DOCKER_PASSWORD'
          }
        }

      }
    }


    stage('Deploy app') {
      steps {
        sh 'docker push unoteck/kmx-compliance-service:latest'
      }
    }

    stage('start app') {
      steps {
        sh 'docker rm --force --volumes kmx-compliance-service'
        sh '''docker compose up --wait
'''
      }
    }

    stage('Get app Log') {
      steps {
        sh 'docker container logs kmx-compliance-service'
      }
    }
  }
}